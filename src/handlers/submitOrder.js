const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const sqs = new SQSClient({});

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);

    if (!body.id || !body.amount || !body.fromAccount || !body.toAccount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Faltan campos requeridos" }),
      };
    }

    const params = {
      QueueUrl: process.env.ORDERS_QUEUE_URL,
      MessageBody: JSON.stringify(body),
    };

    await sqs.send(new SendMessageCommand(params));

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
