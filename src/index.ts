import { DynamoDB } from 'aws-sdk';
import { SQSEvent, SQSHandler, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';

const dynamoDb = new DynamoDB.DocumentClient();

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
    const params: DynamoDB.DocumentClient.WriteRequest[] = [];

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
          Item: {
            siteId,
            ...telemetry,
          }
        }
      };
      params.push(value);

    }
    console.log('params :: ', params)
    console.log('batchItemFailures :: ', batchItemFailures)

    const data: DynamoDB.DocumentClient.BatchWriteItemInput = {
      RequestItems: {
        [TABLE_NAME]: params
      }
    }
    console.log('data :: ', data)
    await dbCall(data, batchItemFailures)
  } catch (err) {
    console.error('err :: ', err)
    batchItemFailures.concat(event.Records.map(r => ({ itemIdentifier: r.messageId })))
  } finally {
    return { batchItemFailures }
  }
};

const dbCall = async (params: DynamoDB.DocumentClient.BatchWriteItemInput, batchItemFailures: SQSBatchItemFailure[]) => {
  try {
    const batchWriteResult = await dynamoDb.batchWrite(params).promise();
    console.log('batchWriteResult dynamo db output :: ', batchWriteResult)
    const { UnprocessedItems } = batchWriteResult;
    if (UnprocessedItems && Object.keys(UnprocessedItems).length > 0) {
      console.log('Unprocessed items found.');
      const unProcessedItemsList = Object.values(UnprocessedItems);
      for (const request of unProcessedItemsList) {
        if (request[0] && request[0].PutRequest) {
          const messageId = request[0].PutRequest.Item.messageId;
          batchItemFailures.push({ itemIdentifier: messageId });
        }
      }
    }
  } catch (error) {
    console.error('Error storing telemetry data: ', error);
  }
}
