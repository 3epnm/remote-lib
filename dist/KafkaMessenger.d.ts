/// <reference types="node" />
import { EventEmitter } from 'events';
import { Kafka } from 'kafkajs';
export declare class KafkaMessenger extends EventEmitter {
    kafka: Kafka;
    config: any;
    connected: boolean;
    running: boolean;
    producer: any;
    consumer: any;
    suffixes: string[];
    constructor(config: any, kafka: Kafka);
    topicConf(topic: string): any;
    topicsCreate(): Promise<void>;
    connect(): Promise<void>;
    send(suffix: string, message: any): Promise<void>;
    read(message: any): Promise<void>;
    write(message: any): Promise<void>;
    request(message: any): Promise<void>;
    disconnect(): Promise<void>;
}
