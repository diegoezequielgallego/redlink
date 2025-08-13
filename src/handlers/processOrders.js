const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log("Evento recibido:", JSON.stringify(event));

  for (const record of event.Records) {
    try {
      const order = JSON.parse(record.body);

      // Validaciones
      const isAmountValid = typeof order.amount === 'number' && !isNaN(order.amount);
      const isFromAccountValid = typeof order.fromAccount === 'string' && /^[0-9]+$/.test(order.fromAccount);
      const isToAccountValid = typeof order.toAccount === 'string' && /^[0-9]+$/.test(order.toAccount);
      const isValid = order.id && isAmountValid && isFromAccountValid && isToAccountValid;

      order.valid = !!isValid;

      // Verificamos si la orden con order.id ya existe en DynamoDB
      const existingOrder = await dynamoDB.get({
        TableName: process.env.ORDERS_TABLE,
        Key: { id: order.id }
      }).promise();

      if (existingOrder.Item) {
        // Orden duplicada
        order.isDuplicate = true;
        console.warn(`Orden con id ${order.id} ya existe. Marcando como duplicada y guardando solo en DynamoDB.`);

        // Guardar en DynamoDB sin subir a S3
        await dynamoDB.put({
          TableName: process.env.ORDERS_TABLE,
          Item: {
            ...order,
            dbId: uuidv4() // id único interno para esta entrada
          }
        }).promise();

        console.log(`Orden duplicada guardada en DynamoDB con dbId ${order.dbId}`);

      } else {
        // Orden nueva
        order.isDuplicate = false;
        order.dbId = uuidv4();

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

        // Guardar siempre en DynamoDB con flag valid e isDuplicate false
        await dynamoDB.put({
          TableName: process.env.ORDERS_TABLE,
          Item: order
        }).promise();

        console.log(`Orden ${order.id} guardada en DynamoDB con valid = ${order.valid} y dbId = ${order.dbId}`);
      }

    } catch (error) {
      console.error("Error procesando orden:", error);
      throw error;
    }
  }
};
