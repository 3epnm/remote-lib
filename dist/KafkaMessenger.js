"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaMessenger = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
class KafkaMessenger extends events_1.EventEmitter {
    constructor(config, kafka) {
        super();
        this.connected = false;
        this.running = false;
        this.suffixes = ['read', 'write', 'request'];
        this.config = config;
        this.kafka = kafka;
    }
    topicConf(topic) {
        return {
            topic,
            numPartitions: 1,
            replicationFactor: 1,
            configEntries: [
                { name: 'cleanup.policy', value: 'compact' },
                { name: 'delete.retention.ms', value: '100' },
                { name: 'segment.ms', value: '100' },
                { name: 'min.cleanable.dirty.ratio', value: '0.01' }
            ]
        };
    }
    async topicsCreate() {
        const createTopics = [];
        const admin = this.kafka.admin();
        await admin.connect();
        const hasTopics = await admin.listTopics();
        for (const suffix of this.suffixes) {
            const topic = this.config.topic + '-' + suffix;
            if (hasTopics.indexOf(topic) < 0) {
                createTopics.push(this.topicConf(topic));
            }
        }
        if (createTopics.length > 0) {
            await admin.createTopics({
                topics: createTopics
            });
        }
        await admin.disconnect();
    }
    async connect() {
        if (!this.connected) {
            await this.topicsCreate();
            this.producer = this.kafka.producer();
            await this.producer.connect();
            this.consumer = this.kafka.consumer({ groupId: this.config.group + '-' + uuid_1.v4() });
            await this.consumer.connect();
            await this.consumer.subscribe({ topic: new RegExp(this.config.topic + '-.*', 'i') });
            await this.consumer.run({
                eachMessage: (payload) => {
                    const evt = payload.topic.substr(payload.topic.lastIndexOf('-') + 1);
                    try {
                        const res = JSON.parse(payload.message.value.toString());
                        console.log('>', payload.topic, res);
                        this.emit(evt, res);
                    }
                    catch (_a) {
                        const res = payload.message.value.toString();
                        console.error('!', 'KafkaMessenger', payload.topic, res);
                    }
                }
            });
            this.connected = true;
        }
    }
    async send(suffix, message) {
        await this.connect();
        const topic = this.config.topic + '-' + suffix;
        console.log('<', topic, message);
        const payload = {
            topic,
            messages: [
                {
                    key: uuid_1.v4(),
                    value: JSON.stringify(message)
                }
            ]
        };
        await this.producer.send(payload);
    }
    async read(message) {
        await this.send('read', message);
    }
    async write(message) {
        await this.send('write', message);
    }
    async request(message) {
        await this.send('request', message);
    }
    async disconnect() {
        if (this.connected) {
            await this.producer.disconnect();
            await this.consumer.disconnect();
        }
    }
}
exports.KafkaMessenger = KafkaMessenger;
//# sourceMappingURL=KafkaMessenger.js.map