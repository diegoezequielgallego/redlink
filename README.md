# 🚀 Sistema de Procesamiento de Órdenes con AWS

[![AWS](https://img.shields.io/badge/AWS-Serverless-orange?style=for-the-badge&logo=amazon-aws)](https://aws.amazon.com/)
[![Lambda](https://img.shields.io/badge/AWS-Lambda-yellow?style=for-the-badge&logo=aws-lambda)](https://aws.amazon.com/lambda/)
[![SQS](https://img.shields.io/badge/AWS-SQS-red?style=for-the-badge&logo=amazon-sqs)](https://aws.amazon.com/sqs/)
[![DynamoDB](https://img.shields.io/badge/AWS-DynamoDB-blue?style=for-the-badge&logo=amazon-dynamodb)](https://aws.amazon.com/dynamodb/)

> **Sistema serverless escalable** para procesar órdenes de manera asíncrona utilizando servicios AWS modernos.

## 📋 Tabla de Contenidos

- [🏗️ Arquitectura](#️-arquitectura)
- [🔄 Flujo de Procesamiento](#-flujo-de-procesamiento)
- [🎯 Decisiones de Diseño](#-decisiones-de-diseño)
- [🔧 Endpoints de Prueba](#-endpoints-de-prueba)
- [⚡ Características](#-características)
- [🚀 Cómo Probar](#-cómo-probar)

---

## 🏗️ Arquitectura

### Componentes del Sistema

| Componente | Descripción | Tecnología |
|------------|-------------|------------|
| **Canales de Entrada** | Interfaces para generar órdenes | Web, Mobile, ATM |
| **API Gateway** | Endpoints REST para órdenes y health-check | AWS API Gateway |
| **OrdersQueue** | Cola de mensajes para desacoplar procesamiento | AWS SQS |
| **OrdersProcessor** | Función serverless para validar y persistir | AWS Lambda |
| **OrdersBucket** | Almacenamiento de órdenes válidas | AWS S3 |
| **DynamoDB** | Base de datos NoSQL para metadatos | AWS DynamoDB |
| **CloudWatch** | Monitoreo y logs del sistema | AWS CloudWatch |
| **DLQ** | Cola para mensajes fallidos | AWS SQS |

### Diagrama de Arquitectura

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Web/Mobile│    │     ATM     │    │   Canales   │
│     Apps    │    │             │    │  Externos   │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                   ┌──────▼──────┐
                   │ API Gateway │
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐
                   │ OrdersQueue │
                   │   (SQS)     │
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐
                   │OrdersProcessor│
                   │   (Lambda)   │
                   └──────┬──────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
         ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
         │   S3    │ │DynamoDB │ │CloudWatch│
         │(JSON)   │ │(Metadata)│ │ (Logs)  │
         └─────────┘ └─────────┘ └─────────┘
```

---

## 🔄 Flujo de Procesamiento

### 1. Recepción de Orden
- **Canal de entrada**: La orden puede provenir de Web, Mobile o ATM
- **API Gateway**: Recibe la petición HTTP y la valida

### 2. Cola de Mensajes
- **SQS (OrdersQueue)**: Recibe la orden como mensaje
- **Lambda al dar error genera reintentos automaticos (10)**: delegarle los reitentos a Lambda con reintentos automáticos

### 3. Procesamiento Lambda

El **`processOrders.js`** es el motor central del sistema que procesa cada orden recibida desde SQS. Realiza las siguientes operaciones:

#### 🔍 **Validaciones de Entrada**
- **Valida que todos los campos requeridos estén presentes y sean correctos

#### 🔄 **Detección de Duplicados**
- **Consulta DynamoDB**: Busca si ya existe una orden con el mismo `orderId`
- **Si es duplicada**: 
  - Marca `isDuplicate = true`
  - Genera un nuevo `id` único con UUID
  - Solo guarda en DynamoDB (no en S3)
- **Si es nueva**: 
  - Marca `isDuplicate = false`
  - Genera un nuevo `id` único con UUID
  - Guarda en DynamoDB y en el S3


#### 📁 **Estrategia de Almacenamiento**
- **S3**: Solo órdenes válidas y no duplicadas → `orders/{orderId}.json`
- **DynamoDB**: Todas las órdenes (válidas, inválidas, duplicadas) con metadatos
- **CloudWatch**: Logs detallados de cada operación para auditoría

#### 🛡️ **Manejo de Errores**
- **Try-catch**: Captura errores individuales por cada orden
- **Logging detallado**: Registra cada paso del proceso
- **Reintentos**: SQS maneja reintentos automáticos si Lambda falla
- **DLQ**: Mensajes fallidos van a Dead Letter Queue después de 10 intentos


---

## 🎯 Decisiones de Diseño

### ✅ Ventajas de la Arquitectura Elegida

| Decisión | Razón | Beneficio |
|----------|-------|-----------|
| **Lambda vs EC2** | Serverless y escalable | Costo eficiente, sin gestión de servidores |
| **SQS** | Entrega confiable | Desacoplamiento, reintentos automáticos |
| **DLQ** | Captura errores persistentes | No pérdida de mensajes, análisis posterior |
| **S3** | Almacenamiento de órdenes válidas | Trazabilidad, descargas posteriores |
| **DynamoDB** | Base de datos NoSQL | Auditoría completa, consultas rápidas |


### 🚀 **Lambda vs EC2: ¿Por qué elegimos Serverless?**

#### 1. **🏗️ Serverless vs Servidor Dedicado**

**AWS Lambda ✅**
- **Infraestructura**: AWS se encarga de aprovisionar, escalar y mantener el entorno
- **Gestión**: No necesitas preocuparte por servidores
- **Configuración**: Solo subes tu código

**EC2 (Servidor Dedicado) ❌**
- **Infraestructura**: Debes aprovisionar, configurar, actualizar y escalar manualmente
- **Gestión**: Responsabilidad total de la infraestructura
- **Configuración**: Configurar SO, middleware, dependencias

#### 2. **📈 Escalabilidad Automática**

**AWS Lambda ✅**
- **Escalado**: Escala automáticamente según eventos SQS
- **Concurrencia**: 100 órdenes = 100 funciones concurrentes automáticamente
- **Velocidad**: Escalado instantáneo

**EC2 ❌**
- **Escalado**: Requiere Auto Scaling Groups y configuración manual
- **Concurrencia**: Debes monitorear carga y crear instancias adicionales
- **Velocidad**: Tiempo de aprovisionamiento de nuevas instancias

#### 3. **💰 Costo**

**AWS Lambda ✅**
- **Pago**: Solo por tiempo de ejecución (milisegundos)
- **Eficiencia**: Ideal para workloads esporádicos/asíncronos
- **Optimización**: Costo proporcional al uso real

**EC2 ❌**
- **Pago**: Por hora de instancia, aunque esté inactiva
- **Eficiencia**: Desperdicio de recursos en carga variable
- **Optimización**: Over-provisioning común para manejar picos

#### 4. **🔧 Mantenimiento**

**AWS Lambda ✅**
- **Sistema Operativo**: AWS maneja SO, parches y actualizaciones
- **Seguridad**: AWS gestiona parches de seguridad
- **Monitoreo**: CloudWatch integrado automáticamente

**EC2 ❌**
- **Sistema Operativo**: Debes mantener SO y actualizaciones
- **Seguridad**: Responsabilidad total de seguridad
- **Monitoreo**: Configurar y mantener herramientas de monitoreo

#### 5. **⚡ Procesamiento Asíncrono**

**AWS Lambda ✅**
- **SQS**: Integración nativa perfecta
- **Event-Driven**: Ideal para procesar órdenes a medida que llegan
- **Eficiencia**: Sin servidores idle esperando mensajes

**EC2 ❌**
- **SQS**: Requiere configuración adicional
- **Event-Driven**: Necesitas servidores siempre encendidos
- **Eficiencia**: Recursos desperdiciados en espera

> **💡 Conclusión**: Lambda es la elección perfecta para este sistema de procesamiento de órdenes porque ofrece escalabilidad automática, costos optimizados y mantenimiento cero, mientras que EC2 requeriría gestión manual compleja y costos fijos innecesarios.

---

## 🔧 Endpoints de Prueba

### Base URL
```
https://xr2nykop37.execute-api.us-east-1.amazonaws.com/dev
```

### 1. 📤 Enviar Orden

**Endpoint:** `POST /orders`

**Ejemplo de Request:**
```bash
curl -X POST https://xr2nykop37.execute-api.us-east-1.amazonaws.com/dev/orders \
  -H "Content-Type: application/json" \
  -d '{
    "id": "order-001",
    "amount": 2580,
    "fromAccount": "1111111",
    "toAccount": "7777777"
  }'
```

**Body JSON:**
```json
{
  "id": "order-001",
  "amount": 2580,
  "fromAccount": "1111111",
  "toAccount": "7777777"
}
```

### 2. 📥 Obtener Orden

**Endpoint:** `GET /orders/{orderId}`

**Ejemplo:**
```bash
curl https://xr2nykop37.execute-api.us-east-1.amazonaws.com/dev/orders/order-001
```

### 3. 🏥 Health Check

**Endpoint:** `GET /health`

**Ejemplo:**
```bash
curl https://xr2nykop37.execute-api.us-east-1.amazonaws.com/dev/health
```

---

## ⚡ Características

### 🔐 Validaciones
- ✅ **Campos requeridos**: `id`, `amount`, `fromAccount`, `toAccount`
- ✅ **Detección de duplicados**: Genera `isDuplicate=true` para órdenes repetidas
- ✅ **Validación de monto**: Verifica que `amount` sea un número válido

### 📊 Almacenamiento
- **S3**: Solo órdenes válidas como archivos JSON
- **DynamoDB**: Todos los registros con campos `valid` e `isDuplicate`
- **CloudWatch**: Logs completos para monitoreo y debugging

### 🔄 Resiliencia
- **Reintentos automáticos**: SQS maneja fallos temporales
- **DLQ**: Captura errores persistentes sin pérdida de datos
- **Escalabilidad**: Sistema serverless que se adapta automáticamente

---

## 🚀 Cómo Probar

### Flujo Completo de Prueba

1. **📤 Enviar una orden**
   ```bash
   curl -X POST https://xr2nykop37.execute-api.us-east-1.amazonaws.com/dev/orders \
     -H "Content-Type: application/json" \
     -d '{"id": "test-001", "amount": 1000, "fromAccount": "123456", "toAccount": "789012"}'
   ```

2. **📥 Verificar la orden**
   ```bash
   curl https://xr2nykop37.execute-api.us-east-1.amazonaws.com/dev/orders/test-001
   ```

3. **🏥 Verificar estado del sistema**
   ```bash
   curl https://xr2nykop37.execute-api.us-east-1.amazonaws.com/dev/health
   ```

### Verificaciones Adicionales

- ✅ **DynamoDB**: Confirmar que la orden se guardó con `valid=true/false`
- ✅ **S3**: Verificar que el JSON esté disponible (solo órdenes válidas)
- ✅ **CloudWatch**: Revisar logs para eventos y errores
- ✅ **DLQ**: Monitorear mensajes fallidos si ocurren errores persistentes

---

## 📝 Notas Importantes

> **💡 Lambdas de Testeo**: Se incluyen dos lambdas adicionales (`Submit Orders` y `Get Orders`) únicamente para facilitar las pruebas del ambiente.

> **⚡ Escalabilidad**: El sistema es completamente serverless y se escala automáticamente según la demanda de órdenes entrantes.

> **🔍 Auditoría**: Todas las órdenes se registran en DynamoDB para auditoría completa, independientemente de su validez.

---


