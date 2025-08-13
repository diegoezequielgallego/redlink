provider "aws" {
  region = "us-east-1"
}

# Cola principal SQS
resource "aws_sqs_queue" "orders_queue" {
  name = "orders-queue"
}

# Dead Letter Queue (DLQ)
resource "aws_sqs_queue" "orders_dlq" {
  name = "orders-dlq"
}

# Bucket S3 para guardar órdenes
resource "aws_s3_bucket" "orders_bucket" {
  bucket = "orders-bucket-${random_id.bucket_id.hex}"
}

resource "random_id" "bucket_id" {
  byte_length = 4
}

# DynamoDB para almacenar órdenes
resource "aws_dynamodb_table" "orders_table" {
  name         = "orders"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "orderId"
    type = "S"
  }

  global_secondary_index {
    name               = "orderId-index"
    hash_key           = "orderId"
    projection_type    = "ALL"
  }
}

# Role para Lambda
resource "aws_iam_role" "lambda_role" {
  name = "orders-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# Política de permisos para Lambda
resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_s3_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_role_policy_attachment" "lambda_dynamo_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_role_policy_attachment" "lambda_sqs_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
}

# Lambda de procesamiento
resource "aws_lambda_function" "process_orders" {
  function_name = "processOrders"
  handler       = "processOrders.handler"
  runtime       = "nodejs20.x"
  role          = aws_iam_role.lambda_role.arn
  filename      = "../build/processOrders.zip"

  environment {
    variables = {
      ORDERS_BUCKET = aws_s3_bucket.orders_bucket.bucket
      ORDERS_TABLE  = aws_dynamodb_table.orders_table.name
    }
  }
}

# Lambda de healthcheck
resource "aws_lambda_function" "health" {
  function_name = "healthCheck"
  handler       = "health.handler"
  runtime       = "nodejs20.x"
  role          = aws_iam_role.lambda_role.arn
  filename      = "../build/health.zip"
}

# API Gateway para exponer /health
resource "aws_apigatewayv2_api" "http_api" {
  name          = "orders-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "health_integration" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.health.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "health_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.health_integration.id}"
}

resource "aws_lambda_permission" "api_gateway_health" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.health.function_name
  principal     = "apigateway.amazonaws.com"
}

# --- Lambda submitOrder ---
resource "aws_lambda_function" "submit_order" {
  function_name = "submitOrder"
  handler       = "submitOrder.handler"
  runtime       = "nodejs20.x"
  role          = aws_iam_role.lambda_role.arn
  filename      = "../build/submitOrder.zip"

  environment {
    variables = {
      ORDERS_QUEUE_URL = aws_sqs_queue.orders_queue.id
    }
  }
}

resource "aws_lambda_permission" "api_gateway_submit_order" {
  statement_id  = "AllowAPIGatewayInvokeSubmitOrder"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.submit_order.function_name
  principal     = "apigateway.amazonaws.com"
}

# --- Lambda getOrder ---
resource "aws_lambda_function" "get_order" {
  function_name = "getOrder"
  handler       = "getOrder.handler"
  runtime       = "nodejs20.x"
  role          = aws_iam_role.lambda_role.arn
  filename      = "../build/getOrder.zip"

  environment {
    variables = {
      ORDERS_TABLE  = aws_dynamodb_table.orders_table.name
      ORDERS_BUCKET = aws_s3_bucket.orders_bucket.bucket
      BUCKET_PUBLIC = "false"
    }
  }
}

resource "aws_lambda_permission" "api_gateway_get_order" {
  statement_id  = "AllowAPIGatewayInvokeGetOrder"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_order.function_name
  principal     = "apigateway.amazonaws.com"
}

# --- API Gateway Rutas para submitOrder y getOrder ---

# Recurso para /orders
resource "aws_apigatewayv2_route" "post_orders_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "POST /orders"
  target    = "integrations/${aws_apigatewayv2_integration.submit_order_integration.id}"
}

resource "aws_apigatewayv2_integration" "submit_order_integration" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.submit_order.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "get_order_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /orders/{orderId}"
  target    = "integrations/${aws_apigatewayv2_integration.get_order_integration.id}"
}

resource "aws_apigatewayv2_integration" "get_order_integration" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.get_order.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_stage" "dev-stage" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "dev"       
  auto_deploy = true             # para que despliegue automáticamente con cada cambio
}

# para conectad la cola SQS a process_orders
resource "aws_lambda_event_source_mapping" "process_orders_sqs" {
  event_source_arn = aws_sqs_queue.orders_queue.arn
  function_name    = aws_lambda_function.process_orders.arn
  batch_size       = 1
  enabled          = true
}
