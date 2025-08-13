const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const orderId = event.pathParameters?.orderId;

  if (!orderId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Falta orderId en la ruta" }),
    };
  }

  try {
    // Obtener orden de DynamoDB por id (clave hash)
    const result = await dynamoDB.get({
      TableName: process.env.ORDERS_TABLE,
      Key: { id: orderId }
    }).promise();

    const order = result.Item;

    if (!order) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Orden no encontrada" }),
      };
    }

    // Construir URL pública del JSON en S3 (o firmada si el bucket es privado)
    const s3Key = `orders/${orderId}.json`;
    let s3Url;

    if (process.env.BUCKET_PUBLIC === 'true') {
      s3Url = `https://${process.env.ORDERS_BUCKET}.s3.amazonaws.com/${s3Key}`;
    } else {
      s3Url = s3.getSignedUrl('getObject', {
        Bucket: process.env.ORDERS_BUCKET,
        Key: s3Key,
        Expires: 300, // 5 minutos
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ order, s3Url }),
    };

  } catch (error) {
    console.error("Error en getOrder:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error interno del servidor" }),
    };
  }
};
