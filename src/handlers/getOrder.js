const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client();
const dynamoDB = new DynamoDBClient();

exports.handler = async (event) => {
  const orderId = event.pathParameters?.orderId;

  if (!orderId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Falta orderId en la ruta" }),
    };
  }

  try {
    const result = await dynamoDB.send(new ScanCommand({
      TableName: process.env.ORDERS_TABLE,
      FilterExpression: "orderId = :id AND isDuplicate = :dup",
      ExpressionAttributeValues: {
        ":id": orderId,
        ":dup": false
      }
    }));
    
    const order = result.Items?.[0];

    if (!order) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Orden no encontrada" }),
      };
    }

    const s3Key = `orders/${orderId}.json`;
    let s3Url;

    if (process.env.BUCKET_PUBLIC === 'true') {
      s3Url = `https://${process.env.ORDERS_BUCKET}.s3.amazonaws.com/${s3Key}`;
    } else {
      const command = new GetObjectCommand({
        Bucket: process.env.ORDERS_BUCKET,
        Key: s3Key,
      });

      s3Url = await getSignedUrl(s3, command, { expiresIn: 300 });
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
