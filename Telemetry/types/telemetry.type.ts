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

export type MessageBody = {
    siteId: String;
    telemetry: Omit<Telemetry, 'siteId'>;
};