const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

// Inicializamos los clientes
const s3 = new S3Client();
const dynamoDB = new DynamoDBClient();

exports.handler = async (event) => {
  console.log("Evento recibido:", JSON.stringify(event));

  for (const record of event.Records) {
    try {
      const order = JSON.parse(record.body);

      // Validaciones
      const isAmountValid = typeof order.amount === "number" && !isNaN(order.amount);
      const isFromAccountValid = typeof order.fromAccount === "string" && /^[0-9]+$/.test(order.fromAccount);
      const isToAccountValid = typeof order.toAccount === "string" && /^[0-9]+$/.test(order.toAccount);
      const isValid = order.orderId && isAmountValid && isFromAccountValid && isToAccountValid;

      order.valid = !!isValid;

      // Verificamos si la orden con order.id ya existe en DynamoDB
      const existingOrder = await dynamoDB.send(new GetCommand({
        TableName: process.env.ORDERS_TABLE,
        Key: { orderId: order.orderId }
      }));
  

      if (existingOrder.Item) {
        // Orden duplicada
        order.isDuplicate = true;
        order.id = uuidv4();
        console.warn(`Orden con id ${order.orderId} ya existe. Marcando como duplicada y guardando solo en DynamoDB.`);

        await dynamoDB.send(new PutCommand({
          TableName: process.env.ORDERS_TABLE,
          Item: order
        }));

        console.log(`Orden duplicada guardada en DynamoDB`);
      } else {
        // Orden nueva
        order.isDuplicate = false;
        order.id = uuidv4();

        if (isValid) {
          // Guardar en S3
          const s3Key = `orders/${order.orderId}.json`;
          await s3.send(new PutObjectCommand({
            Bucket: process.env.ORDERS_BUCKET,
            Key: s3Key,
            Body: JSON.stringify(order),
            ContentType: "application/json"
          }));

          console.log(`Orden ${order.id} procesada correctamente y guardada en S3.`);
        } else {
          console.warn("Orden inválida, no se guardará en S3:", order);
        }

        // Guardar siempre en DynamoDB
        await dynamoDB.send(new PutCommand({
          TableName: process.env.ORDERS_TABLE,
          Item: order
        }));

        console.log(`Orden ${order.orderId} guardada en DynamoDB con valid = ${order.valid} y dbId = ${order.id}`);
      }

    } catch (error) {
      console.error("Error procesando orden:", error);
      throw error;
    }
  }
};
