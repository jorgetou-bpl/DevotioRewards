# Devotio Rewards — Guía de Integración POS vía N8N

## Documento Técnico para Integración de Cashback

**Versión**: 1.0  
**Fecha**: Abril 2026  
**Audiencia**: Equipo técnico del cliente / Implementador N8N

---

## 1. Resumen

Este documento detalla cómo conectar un sistema POS (punto de venta) con la plataforma Devotio Rewards mediante N8N para automatizar dos operaciones de cashback:

- **Agregar cashback**: Cuando un cliente realiza una compra, se acumula cashback automáticamente
- **Redimir cashback**: Cuando un cliente quiere usar su cashback acumulado

---

## 2. Requisitos Previos

| Requisito | Descripción |
|-----------|-------------|
| **API Key** | Proporcionada por Devotio al configurar su cuenta. Formato: cadena alfanumérica de 32 caracteres |
| **N8N** | Instancia activa de N8N (self-hosted o cloud) |
| **POS** | Sistema de punto de venta con capacidad de enviar webhooks HTTP al completar una venta |

---

## 3. Configuración Base

**URL Base de la API:**
```
https://api.digitalwallet.cards/api/v2
```

**Header de autenticación (requerido en TODAS las llamadas):**
```
Apikey: {SU_API_KEY_PROPORCIONADA_POR_DEVOTIO}
```

**Content-Type:**
```
Content-Type: application/json
```

---

## 4. Flujo Completo

```
┌─────────────────┐
│   CLIENTE PAGA   │
│   EN EL POS      │
└────────┬─────────┘
         │
         │  Webhook (datos de la venta)
         ▼
┌─────────────────┐
│      N8N         │
│                  │
│  1. Recibe venta │
│  2. Busca cliente│
│  3. Obtiene ID   │
│     de tarjeta   │
│  4. Envía        │
│     cashback     │
└────────┬─────────┘
         │
         │  API Request
         ▼
┌─────────────────┐
│ DEVOTIO REWARDS  │
│                  │
│ Actualiza saldo  │
│ del cliente      │
└──────────────────┘
```

---

## 5. Estructura del Flujo N8N

El flujo requiere **4 nodos** en N8N:

### Nodo 1: Webhook (Trigger)

**Tipo de nodo**: `Webhook`  
**Método**: `POST`  
**Descripción**: Recibe los datos de la venta desde el POS

**Datos que el POS debe enviar:**

```json
{
  "accion": "agregar",
  "identificador_cliente": "+50688881234",
  "tipo_identificador": "telefono",
  "monto_compra": 15000,
  "nota": "Compra en sucursal Centro"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `accion` | string | Sí | `"agregar"` para acumular cashback, `"redimir"` para usar cashback |
| `identificador_cliente` | string | Sí | Teléfono, email, o ID de tarjeta del cliente |
| `tipo_identificador` | string | Sí | `"telefono"`, `"email"`, o `"tarjeta"` |
| `monto_compra` | number | Sí | Monto de la compra en la moneda local (sin decimales para colones) |
| `monto_redimir` | number | Solo redimir | Monto de cashback a descontar |
| `nota` | string | No | Comentario o referencia de la transacción |

---

### Nodo 2: Buscar Cliente (HTTP Request)

**Tipo de nodo**: `HTTP Request`  
**Descripción**: Busca al cliente en Devotio Rewards para obtener su ID y tarjeta

**Configuración según tipo de identificador:**

#### Si es teléfono:
```
Método: GET
URL: https://api.digitalwallet.cards/api/v2/customers?phone={telefono_del_cliente}
Headers:
  Apikey: {SU_API_KEY}
```

#### Si es email:
```
Método: GET
URL: https://api.digitalwallet.cards/api/v2/customers?email={email_del_cliente}
Headers:
  Apikey: {SU_API_KEY}
```

#### Si es ID de tarjeta (formato XXX-XXX-XXX):
Saltar directamente al **Nodo 3** usando el ID de tarjeta proporcionado.

**Respuesta esperada:**
```json
{
  "code": 200,
  "data": [
    {
      "id": 12345,
      "firstName": "Juan",
      "surname": "Pérez",
      "phone": "+50688881234",
      "email": "juan@email.com"
    }
  ]
}
```

**Dato a extraer**: `data[0].id` → Este es el `customer_id`

---

### Nodo 2b: Obtener Tarjetas del Cliente (HTTP Request)

**Tipo de nodo**: `HTTP Request`  
**Descripción**: Con el `customer_id`, obtener la lista de tarjetas del cliente

```
Método: GET
URL: https://api.digitalwallet.cards/api/v2/customers/{customer_id}/cards
Headers:
  Apikey: {SU_API_KEY}
```

**Respuesta esperada:**
```json
{
  "code": 200,
  "data": [
    {
      "id": "255665-725-189",
      "type": "cashback",
      "templateId": 1234
    }
  ]
}
```

**Dato a extraer**: `data[0].id` → Este es el `card_id` (formato: `XXX-XXX-XXX`)

**Nota**: Si el cliente tiene múltiples tarjetas, filtrar por `type: "cashback"` para obtener la tarjeta de cashback.

---

### Nodo 3: Ejecutar Acción — IF (Router)

**Tipo de nodo**: `IF` o `Switch`  
**Descripción**: Según el campo `accion` del webhook, dirigir al nodo correspondiente

| Condición | Destino |
|-----------|---------|
| `accion == "agregar"` | Nodo 4A: Agregar Cashback |
| `accion == "redimir"` | Nodo 4B: Redimir Cashback |

---

### Nodo 4A: Agregar Cashback (HTTP Request)

**Tipo de nodo**: `HTTP Request`  
**Descripción**: Registra la compra y acumula cashback en la tarjeta del cliente

```
Método: POST
URL: https://api.digitalwallet.cards/api/v2/cards/{card_id}/add-point
Headers:
  Apikey: {SU_API_KEY}
  Content-Type: application/json
```

**Body (JSON):**
```json
{
  "points": 15000,
  "purchaseSum": 15000,
  "comment": "Compra en sucursal Centro"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `points` | number | Sí | Monto de la compra. El sistema calcula el cashback automáticamente según el porcentaje configurado |
| `purchaseSum` | number | Sí | Monto de la compra (mismo valor que `points` para cashback) |
| `comment` | string | No | Nota o referencia. Ejemplo: `"POS Sucursal Centro - Factura #1234"` |

**Respuesta exitosa (code 200):**
```json
{
  "code": 200,
  "data": {
    "id": "255665-725-189",
    "type": "cashback",
    "balance": {
      "balance": 750,
      "cashbackPercent": 5,
      "discountAmount": 15000
    }
  }
}
```

**Interpretación de la respuesta:**
- `balance.balance` = Cashback acumulado disponible para el cliente (ej: 750 colones)
- `balance.cashbackPercent` = Porcentaje de cashback actual (ej: 5%)
- `balance.discountAmount` = Total histórico de compras registradas (en centavos, dividir entre 100)

---

### Nodo 4B: Redimir Cashback (HTTP Request)

**Tipo de nodo**: `HTTP Request`  
**Descripción**: Descuenta cashback acumulado de la tarjeta del cliente

```
Método: POST
URL: https://api.digitalwallet.cards/api/v2/cards/{card_id}/subtract-point
Headers:
  Apikey: {SU_API_KEY}
  Content-Type: application/json
```

**Body (JSON):**
```json
{
  "points": 500,
  "purchaseSum": 500,
  "comment": "Redención cashback - Sucursal Centro"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `points` | number | Sí | Monto de cashback a descontar del saldo del cliente |
| `purchaseSum` | number | Sí | Mismo valor que `points` |
| `comment` | string | No | Nota o referencia de la redención |

**Respuesta exitosa (code 200):**
```json
{
  "code": 200,
  "data": {
    "id": "255665-725-189",
    "type": "cashback",
    "balance": {
      "balance": 250,
      "cashbackPercent": 5
    }
  }
}
```

**Interpretación**: `balance.balance` = Nuevo saldo de cashback después de la redención

---

## 6. Manejo de Errores

| Código | Significado | Acción recomendada |
|--------|-------------|-------------------|
| `200` | Éxito | Transacción procesada correctamente |
| `400` | Datos inválidos | Verificar formato del body (JSON válido, campos requeridos) |
| `401` | API Key inválida | Verificar que el header `Apikey` sea correcto |
| `404` | Cliente o tarjeta no encontrado | Verificar el identificador del cliente o ID de tarjeta |
| `422` | Error de validación | El monto puede ser inválido o la tarjeta no acepta la operación |

**Respuesta de error típica:**
```json
{
  "code": 400,
  "message": "Insufficient balance"
}
```

---

## 7. Ejemplo Completo de Flujo N8N

### Caso: Cliente compra por 10,000 colones

**1. POS envía webhook:**
```json
{
  "accion": "agregar",
  "identificador_cliente": "+50688881234",
  "tipo_identificador": "telefono",
  "monto_compra": 10000,
  "nota": "Factura #4521 - Sucursal Centro"
}
```

**2. N8N busca cliente:**
```
GET /customers?phone=+50688881234
→ Obtiene customer_id: 12345
```

**3. N8N obtiene tarjeta:**
```
GET /customers/12345/cards
→ Obtiene card_id: 255665-725-189
```

**4. N8N agrega cashback:**
```
POST /cards/255665-725-189/add-point
Body: {"points": 10000, "purchaseSum": 10000, "comment": "Factura #4521 - Sucursal Centro"}
→ Respuesta: balance = 500 (5% de 10000)
```

### Caso: Cliente redime 300 colones de cashback

**1. POS envía webhook:**
```json
{
  "accion": "redimir",
  "identificador_cliente": "255665-725-189",
  "tipo_identificador": "tarjeta",
  "monto_compra": 8000,
  "monto_redimir": 300,
  "nota": "Redención cashback - Factura #4522"
}
```

**2. N8N ya tiene el card_id (es el identificador), salta al paso 4:**
```
POST /cards/255665-725-189/subtract-point
Body: {"points": 300, "purchaseSum": 300, "comment": "Redención cashback - Factura #4522"}
→ Respuesta: balance = 200 (saldo restante)
```

---

## 8. Diagrama de Nodos N8N

```
[Webhook]
    │
    ▼
[IF: tipo_identificador == "tarjeta"]
    │                    │
    │ SÍ                 │ NO
    │                    ▼
    │            [HTTP: Buscar Cliente]
    │                    │
    │                    ▼
    │            [HTTP: Obtener Tarjetas]
    │                    │
    ▼                    ▼
[IF: accion == "agregar"]
    │                    │
    │ SÍ                 │ NO (redimir)
    ▼                    ▼
[HTTP: add-point]   [HTTP: subtract-point]
    │                    │
    ▼                    ▼
[Respond to Webhook: éxito/error]
```

---

## 9. Datos de Configuración

Complete estos datos antes de implementar:

| Dato | Valor |
|------|-------|
| **API Key** | _(proporcionada por Devotio)_ |
| **URL del Webhook N8N** | _(generada al crear el nodo Webhook en N8N)_ |
| **URL Base API** | `https://api.digitalwallet.cards/api/v2` |

---

## 10. Soporte

Para dudas sobre la integración o solicitar su API Key, contacte a su representante de **Devotio Rewards**.
