const AWS = require('aws-sdk');

const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log("Evento recibido:", JSON.stringify(event));

  for (const record of event.Records) {
    try {
      const order = JSON.parse(record.body);

      const isValid = order.id && order.amount && order.fromAccount && order.toAccount;

      // Agregamos flag de validez
      order.valid = !!isValid;

      if (isValid) {
        // Guardar JSON en S3 solo si es válido
        const s3Key = `orders/${order.id}.json`;
        await s3.putObject({
          Bucket: process.env.ORDERS_BUCKET,
          Key: s3Key,
          Body: JSON.stringify(order),
          ContentType: 'application/json'
        }).promise();

        console.log(`Orden ${order.id} procesada correctamente y guardada en S3.`);
      } else {
        console.warn("Orden inválida, no se guardará en S3:", order);
      }

      // Guardar siempre en DynamoDB con el flag valid
      await dynamoDB.put({
        TableName: process.env.ORDERS_TABLE,
        Item: order
      }).promise();

      console.log(`Orden ${order.id || 'sin id'} guardada en DynamoDB con valid = ${order.valid}`);

    } catch (error) {
      console.error("Error procesando orden:", error);
      throw error;
    }
  }
};
