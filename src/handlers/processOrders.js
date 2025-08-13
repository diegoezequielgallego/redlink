import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

// Inicializamos los clientes
const s3 = new S3Client();
const dynamoDB = new DynamoDBClient();

export const handler = async (event) => {
  console.log("Evento recibido:", JSON.stringify(event));

  for (const record of event.Records) {
    try {
      const order = JSON.parse(record.body);

      // Validaciones
      const isAmountValid = typeof order.amount === "number" && !isNaN(order.amount);
      const isFromAccountValid = typeof order.fromAccount === "string" && /^[0-9]+$/.test(order.fromAccount);
      const isToAccountValid = typeof order.toAccount === "string" && /^[0-9]+$/.test(order.toAccount);
      const isValid = order.id && isAmountValid && isFromAccountValid && isToAccountValid;

      order.valid = !!isValid;

      // Verificamos si la orden con order.id ya existe en DynamoDB
      const existingOrder = await dynamoDB.send(new GetCommand({
        TableName: process.env.ORDERS_TABLE,
        Key: { id: order.id }
      }));

      if (existingOrder.Item) {
        // Orden duplicada
        order.isDuplicate = true;
        console.warn(`Orden con id ${order.id} ya existe. Marcando como duplicada y guardando solo en DynamoDB.`);

        await dynamoDB.send(new PutCommand({
          TableName: process.env.ORDERS_TABLE,
          Item: {
            ...order,
            dbId: uuidv4()
          }
        }));

        console.log(`Orden duplicada guardada en DynamoDB`);
      } else {
        // Orden nueva
        order.isDuplicate = false;
        order.dbId = uuidv4();

        if (isValid) {
          // Guardar en S3
          const s3Key = `orders/${order.id}.json`;
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

        console.log(`Orden ${order.id} guardada en DynamoDB con valid = ${order.valid} y dbId = ${order.dbId}`);
      }

    } catch (error) {
      console.error("Error procesando orden:", error);
      throw error;
    }
  }
};
