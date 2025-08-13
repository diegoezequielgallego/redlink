exports.handler = async () => {
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "OK",
        uptime: process.uptime(),
        message: "Servicio de órdenes funcionando"
      })
    };
  };
  