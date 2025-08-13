const AWS = require('aws-sdk');
const sqs = new AWS.SQS();

exports.handler = async (event) => {
  try {
    // El body llega como string, parseamos
    const body = JSON.parse(event.body);

    // Validación simple (podés agregar más)
    if (!body.id || !body.amount || !body.fromAccount || !body.toAccount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Faltan campos requeridos" }),
      };
    }

    // Enviar mensaje a la cola SQS
    const params = {
      QueueUrl: process.env.ORDERS_QUEUE_URL,
      MessageBody: JSON.stringify(body),
    };

    await sqs.sendMessage(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Orden enviada a la cola" }),
    };

  } catch (error) {
    console.error("Error en submitOrder:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error interno del servidor" }),
    };
  }
};
