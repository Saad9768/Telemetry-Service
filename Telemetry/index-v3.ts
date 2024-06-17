import {
    BatchWriteItemCommand,
    DynamoDBClient, AttributeValue
} from "@aws-sdk/client-dynamodb";

import { SQSEvent, SQSHandler, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';

type Telemetry = {
    siteId: String;
    version: String;
    creationTime: Number;
    creationTimeISO: Date;
    deviceId: String;
    temperature: {
        celsius: Number;
        fahrenheit: Number;
    },
    currentTimeStamp: Number;
    messageId: string;
};

type MessageBody = {
    siteId: String;
    telemetry: Omit<Telemetry, 'siteId'>;
};

export const handler: SQSHandler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchItemFailure[] = [];
    try {
        const TABLE_NAME = process.env.TABLE_NAME;
        console.log('Inside handler');
        console.log('event :: ', event)
        const { Records } = event;

        if (!TABLE_NAME) {
            throw new Error('Environment does not have Table name');
        }
        const params = [];

        for (const record of Records) {

            const { body, messageId } = record;
            const messageBody: MessageBody = JSON.parse(body);

            const { siteId, telemetry } = messageBody;

            telemetry.currentTimeStamp = new Date().getTime();
            telemetry.messageId = messageId;

            if (!siteId || !telemetry) {
                console.error('Invalid message: ', record);
                batchItemFailures.push({ itemIdentifier: messageId });
                continue;
            }

            const value = {
                PutRequest: {
                    Item: convertToDynamoDBItem({
                        siteId,
                        ...telemetry,
                    })
                }
            };
            params.push(value);

        }
        const data = {
            RequestItems: {
                [TABLE_NAME]: params
            }
        }
        await dbCall(new BatchWriteItemCommand(data), batchItemFailures)
    } catch (err) {
        console.error('err :: ', err)
        batchItemFailures.concat(event.Records.map(r => ({ itemIdentifier: r.messageId })))
    } finally {
        return { batchItemFailures }
    }
};

function convertToDynamoDBItem(data: { [key: string]: any }): { [key: string]: AttributeValue } {
    const item: { [key: string]: AttributeValue } = {};
    for (const key in data) {
        if (typeof data[key] === 'object' && data[key] !== null) {
            item[key] = { M: convertToDynamoDBItem(data[key]) };
        } else if (typeof data[key] === 'number') {
            item[key] = { N: data[key].toString() };
        } else if (typeof data[key] === 'string') {
            item[key] = { S: data[key] };
        }
    }
    return item;
}

const dbCall = async (params: BatchWriteItemCommand, batchItemFailures: SQSBatchItemFailure[]) => {
    try {
        const dynamoDb = new DynamoDBClient({});
        console.info('updating the batch :: ', params);
        const batchWriteResult = await dynamoDb.send(params);
        console.info('batchWriteResult dynamo db output :: ', batchWriteResult)
        const { UnprocessedItems } = batchWriteResult;
        if (UnprocessedItems && Object.keys(UnprocessedItems).length > 0) {
            console.log('Unprocessed items found.');
            const unProcessedItemsList = Object.values(UnprocessedItems);
            for (const request of unProcessedItemsList) {
                if (request[0] && request[0].PutRequest) {
                    const messageId = request[0].PutRequest.Item?.messageId;
                    messageId?.S && batchItemFailures.push({ itemIdentifier: messageId.S });
                }
            }
        }
    } catch (error) {
        throw error;
    }
}
