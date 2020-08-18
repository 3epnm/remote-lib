import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { Kafka } from 'kafkajs'

export class KafkaMessenger extends EventEmitter {
    kafka: Kafka
    config: any

    connected: boolean = false
    running: boolean = false
    producer: any
    consumer: any
    suffixes: string[] = [ 'read', 'write', 'request' ]

    constructor(config: any, kafka: Kafka) {
        super()
        this.config = config
        this.kafka = kafka
    }

    topicConf(topic: string): any {
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
        }
    }

    async topicsCreate(): Promise<void> {
        const createTopics = []

        const admin = this.kafka.admin()
        await admin.connect()

        const hasTopics = await admin.listTopics()
        for (const suffix of this.suffixes) {
            const topic = this.config.topic + '-' + suffix
            if (hasTopics.indexOf(topic) < 0) {
                createTopics.push(this.topicConf(topic))
            }
        }

        if (createTopics.length > 0) {
            await admin.createTopics({
                topics: createTopics
            })
        }
        
        await admin.disconnect()
    }

    async connect(): Promise<void> {
        if (!this.connected) {
            await this.topicsCreate()

            this.producer = this.kafka.producer()
            await this.producer.connect()

            this.consumer = this.kafka.consumer({ groupId: this.config.group + '-' + uuidv4() })
            await this.consumer.connect()

            await this.consumer.subscribe({ topic: new RegExp(this.config.topic + '-.*', 'i') })
            await this.consumer.run({ 
                eachMessage: (payload: any) => {
                    const evt = payload.topic.substr(payload.topic.lastIndexOf('-') + 1)
                    
                    try {
                        const res = JSON.parse(payload.message.value.toString())
                        console.log('>', payload.topic, res)
                        this.emit(evt, res)
                    } catch {
                        const res = payload.message.value.toString()
                        console.error('!', 'KafkaMessenger', payload.topic, res)
                    }
                }
            })

            this.connected = true
        }
    }

    async send(suffix: string, message: any): Promise<void> {
        await this.connect()
        const topic = this.config.topic + '-' + suffix

        console.log('<', topic, message)

        const payload = {
            topic,
            messages: [
                {
                    key: uuidv4(),
                    value: JSON.stringify(message)
                }
            ]
        }

        await this.producer.send(payload)
    }

    async read(message: any): Promise<void> {
        await this.send('read', message)
    }

    async write(message: any): Promise<void> {
        await this.send('write', message)
    }

    async request(message: any): Promise<void> {
        await this.send('request', message)
    }

    async disconnect(): Promise<void> {
        if (this.connected) {
            await this.producer.disconnect()
            await this.consumer.disconnect()
        }
    }
}