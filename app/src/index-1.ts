import { DynamoDB } from 'aws-sdk';
import { SQSEvent, SQSHandler, SQSBatchResponse } from 'aws-lambda';

const dynamoDb = new DynamoDB.DocumentClient();

export const handler: SQSHandler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const TABLE_NAME = process.env.TABLE_NAME;
  console.log('event :: ', event)
  console.log('TABLE_NAME :: ', TABLE_NAME)

  const results = await Promise.all(event.Records.map(async (record) => {
    console.log('Inside handler');
    const messageBody = JSON.parse(record.body);

    const { siteId, data } = messageBody;

    if (!siteId || !data) {
      console.error('Invalid message: ', record);
      return { Id: record.messageId, Status: 'Error' };
    }

    if (!TABLE_NAME) {
      console.error('Environment does not have Table name');
      return { Id: record.messageId, Status: 'Error' };
    }

    data.dataCreatedTimeStamp = new Date().getTime();

    const params = {
      TableName: TABLE_NAME,
      Item: {
        siteId,
        ...data,
      },
    };

    console.log('params :: ', params)

    try {
      const res = await dynamoDb.put(params).promise();
      console.log('res :: ', res)
      console.log(`Telemetry data stored successfully for siteId: ${siteId}`);
      return { Id: record.messageId, Status: 'Success' };
    } catch (error) {
      console.error('Error storing telemetry data: ', error);
      return { Id: record.messageId, Status: 'Error' };
    }
  }));

  const batchItemFailures = results
    .filter(result => result.Status === 'Error')
    .map(result => ({ itemIdentifier: result.Id }));

  return { batchItemFailures };
};
