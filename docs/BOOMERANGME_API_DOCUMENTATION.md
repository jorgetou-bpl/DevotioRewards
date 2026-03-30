# Documentación API Boomerangme - Integración POS

## Índice
1. [Introducción](#introducción)
2. [Autenticación](#autenticación)
3. [URL Base](#url-base)
4. [Identificación de Tarjetas](#identificación-de-tarjetas)
5. [Tarjetas de Sellos (Stamp Cards)](#tarjetas-de-sellos-stamp-cards)
6. [Tarjetas de Recompensas (Reward Cards)](#tarjetas-de-recompensas-reward-cards)
7. [Tarjetas de Descuento (Discount Cards)](#tarjetas-de-descuento-discount-cards)
8. [Webhooks](#webhooks)
9. [Códigos de Error](#códigos-de-error)
10. [Ejemplos Completos](#ejemplos-completos)

---

## Introducción

Esta documentación detalla cómo integrar un sistema POS directamente con la API de Boomerangme para gestionar tarjetas de fidelidad. Cubre las operaciones necesarias para **Tarjetas de Sellos**, **Tarjetas de Recompensas** y **Tarjetas de Descuento**.

---

## Autenticación

Todas las llamadas a la API requieren autenticación mediante una **API Key** en el header.

### Header Requerido

```
X-Api-Key: TU_API_KEY_DE_BOOMERANGME
Content-Type: application/json
```

### Ejemplo cURL

```bash
curl -X GET "https://api.digitalwallet.cards/api/v2/cards/123456-789-012" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json"
```

> **Nota:** La API Key se obtiene desde el panel de administración de Boomerangme.

---

## URL Base

```
https://api.digitalwallet.cards/api/v2
```

Todos los endpoints documentados a continuación usan esta URL base.

---

## Identificación de Tarjetas

### Método 1: Por Card ID (Recomendado)

El Card ID tiene el formato `XXXXXX-XXX-XXX` (ej: `638920-251-210`).

Se obtiene:
- Escaneando el código QR de la tarjeta
- Desde el campo `id` en respuestas de la API

```
GET /cards/{card_id}
```

### Método 2: Por Teléfono o Email del Cliente

Primero buscar el cliente, luego obtener sus tarjetas usando el endpoint de cards con filtro.

**Paso 1: Buscar cliente**
```
GET /customers?phone={numero_telefono}
```
o
```
GET /customers?email={email}
```

**Paso 2: Obtener tarjetas del cliente**
```
GET /cards?customerId={customer_id}
```

> **⚠️ IMPORTANTE:** El endpoint `/customers/{id}/cards` NO existe y devuelve 404. Usar siempre `/cards?customerId={id}` para obtener las tarjetas de un cliente.

### Ejemplo Búsqueda por Teléfono

```bash
# Paso 1: Buscar cliente por teléfono
curl -X GET "https://api.digitalwallet.cards/api/v2/customers?phone=50688881234" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json"

# Respuesta:
# {
#   "code": 200,
#   "data": [
#     {
#       "id": "019bbf9f-55d7-7005-bdb1-45d0aadbd0ae",
#       "firstName": "Juan",
#       "surname": "Pérez",
#       ...
#     }
#   ]
# }

# Paso 2: Obtener tarjetas del cliente (usando el customer_id obtenido)
curl -X GET "https://api.digitalwallet.cards/api/v2/cards?customerId=card-accrual" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json"

# Respuesta:
# {
#   "code": 200,
#   "data": [
#     {
#       "id": "638920-251-210",
#       "type": "subscription",
#       "status": "installed",
#       "customerId": "019bbf9f-55d7-7005-bdb1-45d0aadbd0ae"
#     }
#   ]
# }

# Paso 3 (Opcional): Obtener detalles completos de la tarjeta
curl -X GET "https://api.digitalwallet.cards/api/v2/cards/638920-251-210" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json"
```

### Obtener Todas las Tarjetas (Listado Global)

Para obtener un listado de todas las tarjetas (con paginación):

```bash
curl -X GET "https://api.digitalwallet.cards/api/v2/cards?page=1&per_page=100" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json"
```

**Respuesta:**
```json
{
  "responseId": "...",
  "code": 200,
  "meta": {
    "totalItems": 150,
    "itemsPerPage": 100,
    "currentPage": 1
  },
  "data": [
    {
      "id": "638920-251-210",
      "type": "subscription",
      "status": "installed",
      "customerId": "019bbf9f-55d7-7005-bdb1-45d0aadbd0ae"
    },
    ...
  ]
}
```

---

## Tarjetas de Sellos (Stamp Cards)

Las tarjetas de sellos permiten acumular "sellos" o "visitas" que al llegar a cierta cantidad generan recompensas.

### Consultar Tarjeta

```http
GET /cards/{card_id}
```

**Respuesta:**
```json
{
  "code": 200,
  "data": {
    "id": "638920-251-210",
    "type": "stamp",
    "status": "installed",
    "customer": {
      "firstName": "Juan",
      "surname": "Pérez",
      "phone": "50688881234",
      "email": "juan@email.com"
    },
    "balance": {
      "currentNumberOfUses": 5,
      "numberStampsTotal": 10,
      "stampsBeforeReward": 5,
      "numberRewardsUnused": 0
    }
  }
}
```

**Campos importantes del balance:**
| Campo | Descripción |
|-------|-------------|
| `currentNumberOfUses` | Sellos actuales acumulados |
| `numberStampsTotal` | Total de sellos necesarios para recompensa |
| `stampsBeforeReward` | Sellos que faltan para próxima recompensa |
| `numberRewardsUnused` | Recompensas disponibles para canjear |

---

### Agregar Sellos

Dependiendo de cómo esté configurada la tarjeta en Boomerangme, usar uno de estos endpoints:

#### Opción A: add-stamp (Programa de sellos tradicional)

```http
POST /cards/{card_id}/add-stamp
```

**Body:**
```json
{
  "stamps": 1,
  "comment": "Compra en sucursal Centro",
  "purchaseSum": 25.50
}
```

#### Opción B: add-visit (Programa de visitas)

```http
POST /cards/{card_id}/add-visit
```

**Body:**
```json
{
  "visits": 1,
  "comment": "Visita registrada",
  "purchaseSum": 25.50
}
```

#### Opción C: add-purchase (Programa por monto de compra)

```http
POST /cards/{card_id}/add-purchase
```

**Body:**
```json
{
  "amount": 100.00,
  "purchaseSum": 100.00,
  "comment": "Compra registrada"
}
```

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `stamps` / `visits` / `amount` | number | Sí | Cantidad a agregar |
| `comment` | string | No | Nota o comentario de la transacción |
| `purchaseSum` | number | No | Monto de la compra asociada |

**Respuesta Exitosa:**
```json
{
  "code": 200,
  "data": {
    "id": "638920-251-210",
    "balance": {
      "currentNumberOfUses": 6,
      "numberStampsTotal": 10,
      "stampsBeforeReward": 4,
      "numberRewardsUnused": 0
    }
  }
}
```

> **Tip:** Si no sabe qué tipo de programa tiene la tarjeta, intente con `add-stamp` primero. Si retorna error "Irrelevant accrual type", intente con `add-visit`, y luego `add-purchase`.

---

### Canjear Recompensa (Stamp Card)

Cuando `numberRewardsUnused > 0`, el cliente puede canjear una recompensa.

```http
POST /cards/{card_id}/subtract-reward
```

**Body:**
```json
{
  "rewards": 1,
  "comment": "Recompensa canjeada - Café gratis",
  "purchaseSum": 0
}
```

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `rewards` | number | Sí | Cantidad de recompensas a canjear (usualmente 1) |
| `comment` | string | No | Descripción de la recompensa canjeada |
| `purchaseSum` | number | No | Monto de compra asociado (si aplica) |

**Respuesta:**
```json
{
  "code": 200,
  "data": {
    "balance": {
      "currentNumberOfUses": 0,
      "numberRewardsUnused": 0
    }
  }
}
```

---

## Tarjetas de Recompensas (Reward Cards)

Las tarjetas de recompensas acumulan puntos que pueden canjearse por diferentes niveles de premios.

### Consultar Tarjeta

```http
GET /cards/{card_id}
```

**Respuesta:**
```json
{
  "code": 200,
  "data": {
    "id": "896844-833-112",
    "type": "reward",
    "balance": {
      "bonusBalance": 150,
      "currentNumberOfUses": 5
    },
    "availableRewardTiers": [
      {
        "id": 98061,
        "threshold": 100,
        "name": "Café Gratis",
        "value": 5.00
      },
      {
        "id": 98062,
        "threshold": 200,
        "name": "Postre Gratis",
        "value": 10.00
      }
    ]
  }
}
```

**Campos importantes:**
| Campo | Descripción |
|-------|-------------|
| `bonusBalance` | Puntos acumulados actualmente |
| `availableRewardTiers` | Lista de recompensas disponibles para canjear |
| `availableRewardTiers[].threshold` | Puntos necesarios para esta recompensa |
| `availableRewardTiers[].id` | ID del tier (necesario para canjear) |

---

### Modos de Acumulación

Las tarjetas de recompensa pueden tener 3 modos de acumulación:

#### Modo 1: Por Visita (visit)

Cada transacción suma una cantidad fija de puntos.

```http
POST /cards/{card_id}/add-visit
```

**Body:**
```json
{
  "visits": 1,
  "purchaseSum": 50.00,
  "comment": "Visita registrada"
}
```

#### Modo 2: Por Monto de Compra (spend)

Los puntos se calculan automáticamente según reglas configuradas en Boomerangme.

```http
POST /cards/{card_id}/add-purchase
```

**Body:**
```json
{
  "amount": 100.00,
  "purchaseSum": 100.00,
  "comment": "Compra registrada"
}
```

#### Modo 3: Manual (scores)

Se agregan puntos manualmente según criterio del negocio.

```http
POST /cards/{card_id}/add-scores
```

**Body:**
```json
{
  "scores": 50,
  "purchaseSum": 100.00,
  "comment": "50 puntos agregados manualmente"
}
```

---

### Canjear Recompensa (Reward Card)

Para canjear una recompensa, se necesita el `id` del tier de recompensa.

```http
POST /cards/{card_id}/receive-reward
```

**Body:**
```json
{
  "id": 98061,
  "comment": "Canjeado: Café Gratis",
  "purchaseSum": 0
}
```

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `id` | number | Sí | ID del tier de recompensa (de `availableRewardTiers`) |
| `comment` | string | No | Descripción del canje |
| `purchaseSum` | number | No | Monto de compra asociado |

**Respuesta:**
```json
{
  "code": 200,
  "data": {
    "balance": {
      "bonusBalance": 50
    }
  }
}
```

---

### Restar Puntos Manualmente

```http
POST /cards/{card_id}/subtract-scores
```

**Body:**
```json
{
  "scores": 25,
  "comment": "Ajuste de puntos"
}
```

---

## Tarjetas de Descuento (Discount Cards)

Las tarjetas de descuento acumulan el historial de compras para determinar el nivel de descuento del cliente.

### Consultar Tarjeta

```http
GET /cards/{card_id}
```

**Respuesta:**
```json
{
  "code": 200,
  "data": {
    "id": "185504-436-130",
    "type": "discount",
    "balance": {
      "discountPercentage": 5,
      "discountAmount": 250000
    }
  }
}
```

**Campos importantes:**
| Campo | Descripción |
|-------|-------------|
| `discountPercentage` | Porcentaje de descuento actual del cliente |
| `discountAmount` | Monto total acumulado en compras (en centavos) |

> **Nota:** `discountAmount` está en centavos. Dividir por 100 para obtener el valor real.
> Ejemplo: `250000` = $2,500.00

---

### Registrar Compra (Avanzar en Tiers)

Para registrar una compra y que el cliente avance en los niveles de descuento:

```http
POST /cards/{card_id}/add-point
```

**Body:**
```json
{
  "points": 150.00,
  "purchaseSum": 150.00,
  "comment": "Compra en sucursal Norte"
}
```

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `points` | number | Sí | Monto de la compra (se envía completo, el sistema calcula internamente) |
| `purchaseSum` | number | Sí | Mismo valor que `points` |
| `comment` | string | No | Nota de la transacción |

**Respuesta:**
```json
{
  "code": 200,
  "data": {
    "balance": {
      "discountPercentage": 5,
      "discountAmount": 265000
    }
  }
}
```

> **Importante:** Para tarjetas de descuento, envíe el **monto completo de la compra**. El sistema de Boomerangme calcula internamente el avance en tiers según las reglas configuradas.

---

### Ejemplo de Tiers de Descuento

Configuración típica (definida en Boomerangme):

| Monto Acumulado | Descuento |
|-----------------|-----------|
| $0 - $4,999 | 1% |
| $5,000 - $9,999 | 5% |
| $10,000+ | 10% |

El POS solo necesita registrar compras. El sistema automáticamente ajusta el porcentaje cuando el cliente alcanza un nuevo tier.

---

## Webhooks

Boomerangme puede enviar notificaciones a su sistema cuando ocurren eventos en las tarjetas.

### Configuración

Los webhooks se configuran desde el panel de administración de Boomerangme:
1. Ir a **Configuración** → **Integraciones** → **Webhooks**
2. Agregar la URL de su endpoint
3. Seleccionar los eventos a recibir

### Eventos Disponibles

| Evento | Descripción |
|--------|-------------|
| `card.stamp_added` | Se agregó un sello/visita |
| `card.reward_earned` | El cliente ganó una recompensa |
| `card.reward_redeemed` | Se canjeó una recompensa |
| `card.points_added` | Se agregaron puntos |
| `card.tier_upgraded` | El cliente subió de nivel/tier |
| `card.created` | Nueva tarjeta creada |

### Formato de Webhook

```json
{
  "event": "card.reward_earned",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "card_id": "638920-251-210",
    "customer_id": "uuid-del-cliente",
    "customer_name": "Juan Pérez",
    "balance": {
      "currentNumberOfUses": 10,
      "numberRewardsUnused": 1
    }
  }
}
```

### Respuesta Esperada

Su endpoint debe responder con código `200 OK` para confirmar recepción.

```json
{
  "received": true
}
```

---

## Códigos de Error

| Código | Descripción | Acción Sugerida |
|--------|-------------|-----------------|
| `200` | Éxito | - |
| `400` | Solicitud inválida | Verificar formato del body |
| `401` | No autorizado | Verificar API Key |
| `404` | Tarjeta no encontrada | Verificar card_id |
| `422` | Error de validación | Verificar campos requeridos |
| `429` | Rate limit excedido | Esperar antes de reintentar |
| `500` | Error del servidor | Reintentar después |

### Mensajes de Error Comunes

```json
{
  "code": 400,
  "message": "Irrelevant accrual type for this card"
}
```
> Significa que el tipo de acumulación no coincide. Intentar con otro endpoint (add-stamp, add-visit, add-purchase).

```json
{
  "code": 404,
  "message": "Card not found"
}
```
> El card_id no existe o está mal formateado.

---

## Ejemplos Completos

### Flujo Completo: Tarjeta de Sellos

```bash
# 1. Consultar estado de la tarjeta
curl -X GET "https://api.digitalwallet.cards/api/v2/cards/638920-251-210" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json"

# 2. Agregar un sello
curl -X POST "https://api.digitalwallet.cards/api/v2/cards/638920-251-210/add-stamp" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "stamps": 1,
    "purchaseSum": 35.50,
    "comment": "Compra - Ticket #12345"
  }'

# 3. Si tiene recompensas disponibles, canjear
curl -X POST "https://api.digitalwallet.cards/api/v2/cards/638920-251-210/subtract-reward" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rewards": 1,
    "comment": "Canje de recompensa"
  }'
```

### Flujo Completo: Tarjeta de Recompensas

```bash
# 1. Consultar tarjeta y ver recompensas disponibles
curl -X GET "https://api.digitalwallet.cards/api/v2/cards/896844-833-112" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json"

# 2. Agregar puntos (modo visita)
curl -X POST "https://api.digitalwallet.cards/api/v2/cards/896844-833-112/add-visit" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "visits": 1,
    "purchaseSum": 75.00,
    "comment": "Visita registrada"
  }'

# 3. Canjear recompensa (usando tier id de availableRewardTiers)
curl -X POST "https://api.digitalwallet.cards/api/v2/cards/896844-833-112/receive-reward" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 98061,
    "comment": "Canjeado: Café Gratis"
  }'
```

### Flujo Completo: Tarjeta de Descuento

```bash
# 1. Consultar tarjeta y ver descuento actual
curl -X GET "https://api.digitalwallet.cards/api/v2/cards/185504-436-130" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json"

# 2. Registrar compra (para avanzar en tiers)
curl -X POST "https://api.digitalwallet.cards/api/v2/cards/185504-436-130/add-point" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "points": 250.00,
    "purchaseSum": 250.00,
    "comment": "Compra - Factura #67890"
  }'

# 3. Consultar nuevo estado (verificar si subió de tier)
curl -X GET "https://api.digitalwallet.cards/api/v2/cards/185504-436-130" \
  -H "X-Api-Key: TU_API_KEY" \
  -H "Content-Type: application/json"
```

---

## Resumen de Endpoints

### Consultas (GET)

| Endpoint | Descripción |
|----------|-------------|
| `GET /cards/{card_id}` | Obtener detalles completos de una tarjeta |
| `GET /cards?customerId={id}` | Obtener tarjetas de un cliente específico |
| `GET /cards?page=1&per_page=100` | Listado global de tarjetas (paginado) |
| `GET /customers?phone={phone}` | Buscar cliente por teléfono |
| `GET /customers?email={email}` | Buscar cliente por email |
| `GET /customers?page=1&per_page=100` | Listado de clientes (paginado) |

> **⚠️ NOTA:** El endpoint `/customers/{id}/cards` NO existe. Usar `/cards?customerId={id}` en su lugar.

### Acciones en Tarjetas de Sellos (POST)

| Endpoint | Descripción |
|----------|-------------|
| `POST /cards/{card_id}/add-stamp` | Agregar sellos |
| `POST /cards/{card_id}/add-visit` | Agregar visitas |
| `POST /cards/{card_id}/add-purchase` | Registrar compra |
| `POST /cards/{card_id}/subtract-reward` | Canjear recompensa |

### Acciones en Tarjetas de Recompensas (POST)

| Endpoint | Descripción |
|----------|-------------|
| `POST /cards/{card_id}/add-visit` | Agregar puntos (modo visita) |
| `POST /cards/{card_id}/add-purchase` | Agregar puntos (modo gasto) |
| `POST /cards/{card_id}/add-scores` | Agregar puntos (modo manual) |
| `POST /cards/{card_id}/receive-reward` | Canjear recompensa por tier ID |
| `POST /cards/{card_id}/subtract-scores` | Restar puntos manualmente |

### Acciones en Tarjetas de Descuento (POST)

| Endpoint | Descripción |
|----------|-------------|
| `POST /cards/{card_id}/add-point` | Registrar compra (avanzar en tiers) |

---

## Contacto y Soporte

Para soporte técnico con la API de Boomerangme:
- **Documentación oficial:** https://docs.boomerangme.cards
- **Panel de administración:** https://app.boomerangme.cards

---

*Documento generado para integración POS con Boomerangme API*
*Versión: 1.0 | Fecha: Febrero 2026*
