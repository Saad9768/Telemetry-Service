import { SQSEvent, Context, Callback, SQSBatchResponse } from 'aws-lambda';
import { DynamoDBClient, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { handler } from '../../index';
import { mockClient } from "aws-sdk-client-mock";

const ddbMock = mockClient(DynamoDBClient);

describe('handler', () => {
    const TABLE_NAME = 'TelemetryTable';
    process.env.TABLE_NAME = TABLE_NAME;

    beforeEach(() => {
        ddbMock.reset();
    });

    const createSQSEvent = (records: any[]): SQSEvent => ({
        Records: records.map(record => ({
            messageId: record.messageId,
            receiptHandle: 'handle',
            body: JSON.stringify(record.body),
            attributes: {
                ApproximateReceiveCount: '',
                SentTimestamp: '',
                SenderId: '',
                ApproximateFirstReceiveTimestamp: ''
            },
            messageAttributes: {},
            md5OfBody: '',
            eventSource: '',
            eventSourceARN: '',
            awsRegion: ''
        })),
    });

    const context: Context = {
        functionName: 'functionName',
        functionVersion: '1',
        invokedFunctionArn: 'arn',
        memoryLimitInMB: '128',
        awsRequestId: 'requestId',
        logGroupName: 'logGroup',
        logStreamName: 'logStream',
        identity: undefined,
        clientContext: undefined,
        getRemainingTimeInMillis: () => 1000,
        done: (error?: Error, result?: any): void => { },
        fail: (error: Error | string): void => { },
        succeed: (messageOrObject: any): void => { },
        callbackWaitsForEmptyEventLoop: false
    };

    const callback: Callback = (error, result) => {
        if (error) {
            console.error(error);
        } else {
            console.log(result);
        }
    };

    it('should process valid messages successfully', async () => {
        const event = createSQSEvent([
            {
                messageId: '1',
                body: {
                    siteId: 'site1',
                    telemetry: {
                        version: '1.0',
                        creationTime: 1627889181,
                        creationTimeISO: new Date(),
                        deviceId: 'device1',
                        temperature: { celsius: 25, fahrenheit: 77 },
                    },
                }
            }
        ]);
        ddbMock.on(BatchWriteItemCommand).resolves({});
        const response: SQSBatchResponse = await handler(event, context, callback) as SQSBatchResponse;
        expect(response.batchItemFailures).toHaveLength(0);
    });

    it('should handle invalid messages and add to batchItemFailures', async () => {
        const event = createSQSEvent([
            {
                messageId: '1',
                body: {
                    telemetry: {
                        version: '1.0',
                        creationTime: 1627889181,
                        creationTimeISO: new Date(),
                        deviceId: 'device1',
                        temperature: { celsius: 25, fahrenheit: 77 },
                    },
                }
            }
        ]);
        ddbMock.on(BatchWriteItemCommand).resolves({});

        const response: SQSBatchResponse = await handler(event, context, callback) as SQSBatchResponse;
        expect(response.batchItemFailures).toHaveLength(1);
        expect(response.batchItemFailures[0].itemIdentifier).toBe('1');
    });

    it('should handle DynamoDB write failures and add to batchItemFailures', async () => {
        ddbMock.on(BatchWriteItemCommand).resolves({
            UnprocessedItems: {
                [TABLE_NAME]: [
                    {
                        PutRequest: {
                            Item: { "siteId": { "S": "12" }, "messageId": { "S": "1" }, "version": { "S": "1.0" }, "creationTime": { "N": "1625567890" }, "creationTimeISO": { "S": "2021-07-06T12:34:50Z" }, "deviceId": { "S": "device-15" }, "temperature": { "M": { "celsius": { "N": "25" }, "fahrenheit": { "N": "77" } } } }
                        },
                    },
                ],
            },
        });

        const event = createSQSEvent([
            {
                messageId: '1',
                body: {
                    siteId: 'site1',
                    telemetry: {
                        version: '1.0',
                        creationTime: 1627889181,
                        creationTimeISO: new Date(),
                        deviceId: 'device1',
                        temperature: { celsius: 25, fahrenheit: 77 },
                    },
                }
            }
        ]);

        const response: SQSBatchResponse = await handler(event, context, callback) as SQSBatchResponse;
        expect(response.batchItemFailures).toHaveLength(1);
        expect(response.batchItemFailures[0].itemIdentifier).toBe('1');
    });
});
