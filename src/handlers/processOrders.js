const AWS = require('aws-sdk');

const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log("Evento recibido:", JSON.stringify(event));

  for (const record of event.Records) {
    try {
      const order = JSON.parse(record.body);

      if (!order.id || !order.amount || !order.fromAccount || !order.toAccount) {
        console.error("Orden inválida:", order);
        continue;
      }

      const s3Key = `orders/${order.id}.json`;
      await s3.putObject({
        Bucket: process.env.ORDERS_BUCKET,
        Key: s3Key,
        Body: JSON.stringify(order),
        ContentType: 'application/json'
      }).promise();

      await dynamoDB.put({
        TableName: process.env.ORDERS_TABLE,
        Item: order
      }).promise();

      console.log(`Orden ${order.id} procesada correctamente`);

    } catch (error) {
      console.error("Error procesando orden:", error);
      throw error;
    }
  }
};
