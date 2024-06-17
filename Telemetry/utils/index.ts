import { AttributeValue } from "@aws-sdk/client-dynamodb";

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

export { convertToDynamoDBItem };