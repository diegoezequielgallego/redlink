# Sistema de Procesamiento de Órdenes con AWS

Este proyecto implementa un sistema **serverless** para procesar órdenes de manera asíncrona utilizando **AWS Lambda**, **SQS**, **S3** y **DynamoDB**. Incluye endpoints de prueba para enviar órdenes y verificar su estado.

---

## Diagrama de Secuencia y Flujo

El flujo de procesamiento de órdenes es el siguiente:

1. **Canal de entrada**: La orden puede provenir de la web, mobile o ATM.
2. **SQS (OrdersQueue)**: Recibe la orden como mensaje y garantiza entrega confiable a Lambda.
3. **Lambda OrdersProcessor**:
   - Valida la orden (`amount`, `fromAccount`, `toAccount`).
   - Si es válida, guarda el JSON de la orden en **S3**.
   - Guarda la orden en **DynamoDB**, indicando `valid=true` o `valid=false`.
   - Registra eventos y errores en **CloudWatch Logs**.
4. **DLQ (Orders DLQ SQS)**: Si un mensaje falla después de múltiples intentos, se envía aquí para análisis posterior.
5. **Reintentos**: SQS se encarga de reintentar mensajes temporalmente fallidos.

---

## Arquitectura General

El sistema cuenta con los siguientes componentes:

- **Canales (Web/Mobile/ATM)**: Interfaces donde se generan las órdenes.
- **API Gateway / Health-check**: Endpoints REST para enviar órdenes y verificar el estado del sistema.
- **OrdersQueue (SQS)**: Cola que desacopla la recepción y procesamiento de órdenes.
- **OrdersProcessor Lambda**: Función serverless que valida y persiste las órdenes.
- **OrdersBucket (S3)**: Almacena los JSON de órdenes válidas.
- **DynamoDB (NoSQL DB)**: Guarda metadatos de cada orden (`valid`, `isDuplicate`, `orderId`).
- **CloudWatch Logs**: Monitoreo y registro de errores y eventos.
- **Orders DLQ (SQS)**: Captura mensajes que no se pudieron procesar después de varios intentos.
- **HealthCheck Lambda**: Endpoint que valida el estado de la aplicación.

---

## Decisiones de Diseño

- **Lambda vs EC2**: Se eligió Lambda por ser serverless, escalable automáticamente y costo eficiente para procesamiento asíncrono de mensajes.
- **SQS**: Garantiza entrega confiable, desacopla la producción y consumo de mensajes, y permite reintentos automáticos.
- **DLQ**: Permite capturar errores persistentes sin perder mensajes y facilita su análisis.
- **S3**: Almacena las órdenes válidas como JSON para trazabilidad y posibles descargas posteriores.
- **DynamoDB**: Guarda todos los registros de órdenes para auditoría y consultas rápidas.

---

## Endpoints de Prueba

### 1. Enviar Orden (Submit Order)


---

## Endpoints de prueba

1. **Submit Order**

POST https://xr2nykop37.execute-api.us-east-1.amazonaws.com/dev/orders

**Body ejemplo:**
```json
{
  "id": "order-001",
  "amount": 2580,
  "fromAccount": "1111111",
  "toAccount": "7777777"
}


Get Order

GET https://xr2nykop37.execute-api.us-east-1.amazonaws.com/dev/orders/order-001


Health-check

GET https://xr2nykop37.execute-api.us-east-1.amazonaws.com/dev/health


Consideraciones de funcionamiento

    Cada orden tiene un orderId único.

    Si se recibe una orden duplicada, se genera un nuevo registro con isDuplicate=true.

    Solo las órdenes válidas se guardan en S3.

    DynamoDB almacena todas las órdenes, con los campos valid y isDuplicate para auditoría.

    CloudWatch permite monitorear eventos y errores.

    DLQ captura mensajes que no pudieron ser procesados después de varios intentos.

Cómo probar el flujo completo

    Enviar una orden usando el endpoint POST /orders.

    Verificar que la orden se haya guardado en DynamoDB (valid=true/false).

    Revisar el JSON en S3 utilizando la URL proporcionada por GET /orders/:orderId.

    Validar logs en CloudWatch y el comportamiento de DLQ si ocurre un error persistente.


Notas adicionales

    Se agregaron dos lambdas únicamente para testeo del ambiente: Submit Orders y Get Orders.

    El sistema es completamente serverless y escalable automáticamente según la cantidad de órdenes entrantes.