import { DynamoDB } from 'aws-sdk';
import { SQSEvent, SQSHandler, SQSBatchResponse } from 'aws-lambda';

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
  dataCreatedTimeStamp: Number;
};

type MessageBody = {
  siteId: String;
  telemetry: Omit<Telemetry, 'siteId'>;
};

export const handler: SQSHandler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  try {
    const TABLE_NAME = process.env.TABLE_NAME;
    console.log('event :: ', event)
    const { Records } = event;
    const results = await Promise.all(Records.map((record) => {
      console.log('Inside handler');
      const messageBody: MessageBody = JSON.parse(record.body);

      const { siteId, telemetry } = messageBody;

      if (!siteId || !telemetry) {
        console.error('Invalid message: ', record);
        return { Id: record.messageId, Status: 'Error' };
      }

      if (!TABLE_NAME) {
        console.error('Environment does not have Table name');
        return { Id: record.messageId, Status: 'Error' };
      }

      telemetry.dataCreatedTimeStamp = new Date().getTime();

      const params = {
        TableName: TABLE_NAME,
        Item: {
          siteId,
          ...telemetry,
        },
      };

      console.log('params :: ', params)

      return dbCall(record.messageId, params);
    }));

    const batchItemFailures = results
      .filter(result => result.Status === 'Error')
      .map(result => ({ itemIdentifier: result.Id }));

    return { batchItemFailures };

  } catch (error) {
    console.error('Unhandled exception :: ', error)
    const batchItemFailures = event.Records.map(r => ({ itemIdentifier: r.messageId }));
    return { batchItemFailures }
  }
};

const dbCall = async (messageId: string, params: {
  TableName: string;
  Item: Telemetry;
}) => {
  try {
    await dynamoDb.put(params).promise();
    console.info(`Telemetry data stored successfully for siteId: ${params.Item.siteId}`);
    return { Id: messageId, Status: 'Success' };
  } catch (error) {
    console.error('Error storing telemetry data: ', error);
    return { Id: messageId, Status: 'Error' };
  }
}
