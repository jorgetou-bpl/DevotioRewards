# Guía de Integración POS - Boomerangme Cashback API

**Versión:** 1.0  
**Fecha:** Enero 2026  
**API Version:** v2.0

---

## Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Requisitos Previos](#requisitos-previos)
3. [Autenticación](#autenticación)
4. [Flujo de Operaciones](#flujo-de-operaciones)
5. [Endpoints API](#endpoints-api)
6. [Cálculo de Cashback](#cálculo-de-cashback)
7. [Ejemplos de Código](#ejemplos-de-código)
8. [Manejo de Errores](#manejo-de-errores)
9. [Límites y Restricciones](#límites-y-restricciones)
10. [Webhooks (Opcional)](#webhooks-opcional)
11. [FAQ](#faq)

---

## Resumen Ejecutivo

Este documento describe cómo integrar un sistema POS directamente con la API de Boomerangme para gestionar tarjetas de cashback. La integración permite:

- ✅ Consultar el balance de cashback de un cliente
- ✅ Acumular cashback basado en compras
- ✅ Canjear cashback como forma de pago
- ✅ Obtener información del cliente

**Base URL:** `https://api.digitalwallet.cards/api/v2`

---

## Requisitos Previos

### 1. API Key de Boomerangme
Obtener desde: **Boomerangme Dashboard → Configuración → Integraciones**

### 2. Información Técnica del POS
- Capacidad de realizar llamadas HTTP REST
- Soporte para headers de autenticación
- Manejo de respuestas JSON

### 3. Datos de Tarjeta
El cliente debe proporcionar uno de los siguientes:
- ID de tarjeta (ej: `192362-967-174`)
- Número de teléfono
- Email

---

## Autenticación

Todas las llamadas API requieren el header de autorización:

```
Authorization: Bearer {API_KEY}
Content-Type: application/json
```

**Ejemplo:**
```http
GET /api/v2/cards/192362-967-174
Host: api.digitalwallet.cards
Authorization: Bearer sk_live_abc123xyz789
Content-Type: application/json
```

---

## Flujo de Operaciones

### Flujo para Acumular Cashback (Venta)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE ACUMULACIÓN                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Cliente presenta tarjeta/teléfono                               │
│                    ↓                                                │
│  2. POS consulta tarjeta: GET /cards/{id}                          │
│                    ↓                                                │
│  3. POS obtiene: nombre cliente + % cashback                        │
│                    ↓                                                │
│  4. POS calcula puntos: monto × (% / 100)                          │
│                    ↓                                                │
│  5. POS registra cashback: POST /cards/{id}/add-point              │
│                    ↓                                                │
│  6. Mostrar confirmación al cliente                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Flujo para Canjear Cashback (Redención)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FLUJO DE CANJE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Cliente solicita usar cashback                                  │
│                    ↓                                                │
│  2. POS consulta balance: GET /cards/{id}                          │
│                    ↓                                                │
│  3. POS verifica balance disponible (balance.balance)               │
│                    ↓                                                │
│  4. POS descuenta: POST /cards/{id}/subtract-point                 │
│                    ↓                                                │
│  5. Aplicar descuento al total de la venta                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Endpoints API

### 1. Consultar Tarjeta por ID

**Endpoint:** `GET /cards/{card_id}`

**Descripción:** Obtiene la información completa de una tarjeta incluyendo datos del cliente y balance.

**Request:**
```http
GET /api/v2/cards/192362-967-174
Authorization: Bearer {API_KEY}
```

**Response (200 OK):**
```json
{
  "code": 200,
  "data": {
    "id": "192362-967-174",
    "type": "cashback",
    "customer": {
      "id": "uuid-cliente",
      "firstName": "Juan",
      "surname": "Pérez",
      "phone": "+50688887777",
      "email": "juan@email.com"
    },
    "balance": {
      "balance": 1500.00,
      "cashbackPercent": 5.0,
      "bonusBalance": 0
    },
    "countVisits": 15,
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2026-01-29T14:22:00Z"
  }
}
```

**Campos importantes:**
| Campo | Descripción |
|-------|-------------|
| `data.customer.firstName` | Nombre del cliente |
| `data.customer.surname` | Apellido del cliente |
| `data.balance.balance` | Balance actual de cashback (en moneda) |
| `data.balance.cashbackPercent` | Porcentaje de cashback configurado |

---

### 2. Buscar Tarjeta por Teléfono

**Endpoint:** `GET /cards?phone={phone}`

**Request:**
```http
GET /api/v2/cards?phone=+50688887777
Authorization: Bearer {API_KEY}
```

**Response:** Lista de tarjetas asociadas al teléfono.

---

### 3. Buscar Tarjeta por Email

**Endpoint:** `GET /cards?email={email}`

**Request:**
```http
GET /api/v2/cards?email=juan@email.com
Authorization: Bearer {API_KEY}
```

---

### 4. Agregar Cashback (Acumular)

**Endpoint:** `POST /cards/{card_id}/add-point`

**Descripción:** Agrega puntos/cashback a la tarjeta del cliente basado en una compra.

**Request:**
```http
POST /api/v2/cards/192362-967-174/add-point
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "points": 500.00,
  "purchaseSum": 10000.00,
  "comment": "Venta #12345 - Terminal 01 - Cajero: María"
}
```

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `points` | float | ✅ Sí | Cantidad de cashback a agregar (YA CALCULADO) |
| `purchaseSum` | float | ❌ No | Monto total de la compra (para tracking/LTV) |
| `comment` | string | ❌ No | Nota/referencia de la transacción |

**Response (200 OK):**
```json
{
  "code": 200,
  "data": {
    "id": "192362-967-174",
    "balance": {
      "balance": 2000.00,
      "cashbackPercent": 5.0
    }
  }
}
```

---

### 5. Canjear Cashback (Redimir)

**Endpoint:** `POST /cards/{card_id}/subtract-point`

**Descripción:** Descuenta cashback del balance del cliente.

**Request:**
```http
POST /api/v2/cards/192362-967-174/subtract-point
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "points": 500.00,
  "purchaseSum": 5000.00,
  "comment": "Canje en venta #12346 - Terminal 01"
}
```

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `points` | float | ✅ Sí | Cantidad de cashback a descontar |
| `purchaseSum` | float | ❌ No | Monto de la compra donde se aplica |
| `comment` | string | ❌ No | Nota/referencia |

**Response (200 OK):**
```json
{
  "code": 200,
  "data": {
    "id": "192362-967-174",
    "balance": {
      "balance": 1500.00
    }
  }
}
```

**Errores comunes:**
- `400`: Balance insuficiente
- `404`: Tarjeta no encontrada

---

## Cálculo de Cashback

### ⚠️ IMPORTANTE: La API NO calcula automáticamente

Boomerangme **NO** calcula automáticamente los puntos de cashback. El porcentaje configurado (por tiers: Bronce/Plata/Oro) se refleja en el campo `cashbackPercent`, pero el cálculo debe hacerse en el POS.

### Fórmula de Cálculo

```
cashback_a_agregar = monto_compra × (cashbackPercent / 100)
```

### Ejemplo Práctico

```
Configuración en Boomerangme:
- Tier Bronce: 3% cashback
- Tier Plata: 5% cashback  
- Tier Oro: 8% cashback

Cliente "Juan" está en Tier Plata (5%)

Compra: ₡10,000

Paso 1: GET /cards/192362-967-174
        → Response: { balance: { cashbackPercent: 5.0 } }

Paso 2: Calcular en POS
        → cashback = 10000 × (5 / 100) = 500

Paso 3: POST /cards/192362-967-174/add-point
        → Body: { "points": 500, "purchaseSum": 10000 }
```

### Código de Ejemplo (Pseudocódigo)

```javascript
// Función para acumular cashback
async function acumularCashback(cardId, montoCompra, comentario) {
    
    // 1. Consultar tarjeta para obtener el %
    const tarjeta = await GET(`/cards/${cardId}`);
    const porcentaje = tarjeta.data.balance.cashbackPercent;
    
    // 2. Calcular cashback
    const cashback = montoCompra * (porcentaje / 100);
    
    // 3. Registrar en Boomerangme
    const resultado = await POST(`/cards/${cardId}/add-point`, {
        points: cashback,
        purchaseSum: montoCompra,
        comment: comentario
    });
    
    return {
        nuevoBalance: resultado.data.balance.balance,
        cashbackAgregado: cashback
    };
}
```

---

## Ejemplos de Código

### cURL - Consultar Tarjeta

```bash
curl -X GET "https://api.digitalwallet.cards/api/v2/cards/192362-967-174" \
  -H "Authorization: Bearer sk_live_abc123xyz789" \
  -H "Content-Type: application/json"
```

### cURL - Agregar Cashback

```bash
curl -X POST "https://api.digitalwallet.cards/api/v2/cards/192362-967-174/add-point" \
  -H "Authorization: Bearer sk_live_abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "points": 500,
    "purchaseSum": 10000,
    "comment": "Venta #12345 - Terminal 01"
  }'
```

### cURL - Canjear Cashback

```bash
curl -X POST "https://api.digitalwallet.cards/api/v2/cards/192362-967-174/subtract-point" \
  -H "Authorization: Bearer sk_live_abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{
    "points": 300,
    "purchaseSum": 5000,
    "comment": "Canje venta #12346"
  }'
```

### Python

```python
import requests

API_KEY = "sk_live_abc123xyz789"
BASE_URL = "https://api.digitalwallet.cards/api/v2"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def consultar_tarjeta(card_id):
    """Obtiene información de la tarjeta"""
    response = requests.get(
        f"{BASE_URL}/cards/{card_id}",
        headers=HEADERS
    )
    return response.json()

def agregar_cashback(card_id, monto_compra, comentario=""):
    """Calcula y agrega cashback basado en la compra"""
    
    # 1. Obtener porcentaje actual
    tarjeta = consultar_tarjeta(card_id)
    porcentaje = tarjeta["data"]["balance"]["cashbackPercent"]
    
    # 2. Calcular cashback
    cashback = monto_compra * (porcentaje / 100)
    
    # 3. Registrar
    response = requests.post(
        f"{BASE_URL}/cards/{card_id}/add-point",
        headers=HEADERS,
        json={
            "points": cashback,
            "purchaseSum": monto_compra,
            "comment": comentario
        }
    )
    return response.json()

def canjear_cashback(card_id, monto_canje, monto_compra=0, comentario=""):
    """Descuenta cashback del balance"""
    
    response = requests.post(
        f"{BASE_URL}/cards/{card_id}/subtract-point",
        headers=HEADERS,
        json={
            "points": monto_canje,
            "purchaseSum": monto_compra,
            "comment": comentario
        }
    )
    return response.json()

# Ejemplo de uso
if __name__ == "__main__":
    card_id = "192362-967-174"
    
    # Consultar
    info = consultar_tarjeta(card_id)
    print(f"Cliente: {info['data']['customer']['firstName']}")
    print(f"Balance: {info['data']['balance']['balance']}")
    print(f"% Cashback: {info['data']['balance']['cashbackPercent']}")
    
    # Agregar cashback por compra de 10,000
    resultado = agregar_cashback(card_id, 10000, "Venta #001")
    print(f"Nuevo balance: {resultado['data']['balance']['balance']}")
```

### JavaScript/Node.js

```javascript
const axios = require('axios');

const API_KEY = 'sk_live_abc123xyz789';
const BASE_URL = 'https://api.digitalwallet.cards/api/v2';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
    }
});

// Consultar tarjeta
async function consultarTarjeta(cardId) {
    const response = await api.get(`/cards/${cardId}`);
    return response.data;
}

// Agregar cashback
async function agregarCashback(cardId, montoCompra, comentario = '') {
    // 1. Obtener porcentaje
    const tarjeta = await consultarTarjeta(cardId);
    const porcentaje = tarjeta.data.balance.cashbackPercent;
    
    // 2. Calcular
    const cashback = montoCompra * (porcentaje / 100);
    
    // 3. Registrar
    const response = await api.post(`/cards/${cardId}/add-point`, {
        points: cashback,
        purchaseSum: montoCompra,
        comment: comentario
    });
    
    return {
        cashbackAgregado: cashback,
        nuevoBalance: response.data.data.balance.balance
    };
}

// Canjear cashback
async function canjearCashback(cardId, montoCanje, comentario = '') {
    const response = await api.post(`/cards/${cardId}/subtract-point`, {
        points: montoCanje,
        comment: comentario
    });
    return response.data;
}

// Ejemplo
(async () => {
    try {
        const cardId = '192362-967-174';
        
        // Consultar
        const info = await consultarTarjeta(cardId);
        console.log('Cliente:', info.data.customer.firstName);
        console.log('Balance:', info.data.balance.balance);
        
        // Agregar cashback
        const resultado = await agregarCashback(cardId, 10000, 'Venta #001');
        console.log('Cashback agregado:', resultado.cashbackAgregado);
        console.log('Nuevo balance:', resultado.nuevoBalance);
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
})();
```

---

## Manejo de Errores

### Códigos de Respuesta HTTP

| Código | Significado | Acción |
|--------|-------------|--------|
| `200` | Éxito | Procesar respuesta normalmente |
| `400` | Solicitud inválida | Verificar parámetros enviados |
| `401` | No autorizado | Verificar API Key |
| `404` | No encontrado | Tarjeta/cliente no existe |
| `422` | Error de validación | Verificar formato de datos |
| `429` | Rate limit excedido | Esperar y reintentar |
| `500` | Error del servidor | Reintentar o contactar soporte |

### Ejemplo de Manejo de Errores

```python
def procesar_con_manejo_errores(card_id, monto):
    try:
        resultado = agregar_cashback(card_id, monto)
        return {"exito": True, "data": resultado}
        
    except requests.exceptions.HTTPError as e:
        codigo = e.response.status_code
        
        if codigo == 404:
            return {"exito": False, "error": "Tarjeta no encontrada"}
        elif codigo == 401:
            return {"exito": False, "error": "API Key inválida"}
        elif codigo == 429:
            return {"exito": False, "error": "Demasiadas solicitudes, intente en 1 minuto"}
        elif codigo == 400:
            return {"exito": False, "error": "Balance insuficiente para canje"}
        else:
            return {"exito": False, "error": f"Error desconocido: {codigo}"}
            
    except requests.exceptions.ConnectionError:
        return {"exito": False, "error": "Sin conexión a internet"}
```

---

## Límites y Restricciones

### Rate Limiting

| Límite | Valor |
|--------|-------|
| Requests por segundo | 10 |
| Requests por minuto | 600 |

**Comportamiento al exceder:** HTTP 429 (Too Many Requests)

### Recomendaciones

1. **Implementar retry con backoff exponencial**
   ```
   Intento 1: Esperar 1 segundo
   Intento 2: Esperar 2 segundos
   Intento 3: Esperar 4 segundos
   ```

2. **Cachear consultas frecuentes**
   - Guardar datos del cliente por 5-10 minutos
   - No consultar la misma tarjeta múltiples veces por transacción

3. **Usar comentarios descriptivos**
   - Incluir número de ticket/factura
   - Incluir terminal/cajero para auditoría

---

## Webhooks (Opcional)

Boomerangme puede notificar al POS cuando ocurren eventos. Configurar en: **Dashboard → Configuración → Webhooks**

### Eventos Disponibles

| Evento | Descripción |
|--------|-------------|
| `CardBalanceUpdatedEvent` | Balance modificado (acumulación/canje) |
| `CardScannedEvent` | Tarjeta escaneada |
| `CardIssuedEvent` | Nueva tarjeta emitida |

### Ejemplo de Payload

```json
{
  "event": "CardBalanceUpdatedEvent",
  "timestamp": "2026-01-29T14:30:00Z",
  "data": {
    "cardId": "192362-967-174",
    "previousBalance": 1500,
    "newBalance": 2000,
    "changeAmount": 500,
    "source": "api"
  }
}
```

---

## FAQ

### ¿El porcentaje de cashback se calcula automáticamente?
**No.** Boomerangme devuelve el porcentaje configurado (según tier del cliente), pero el POS debe calcular y enviar el valor de `points`.

### ¿Qué pasa si el cliente tiene diferentes tiers?
El campo `cashbackPercent` ya refleja el tier actual del cliente. Si el cliente sube de Bronce a Plata, el porcentaje se actualiza automáticamente en Boomerangme.

### ¿Puedo canjear más cashback del disponible?
**No.** La API retornará error 400 si se intenta canjear más del balance disponible.

### ¿Cómo identifico al cliente si no tiene el ID de tarjeta?
Usa los endpoints de búsqueda:
- Por teléfono: `GET /cards?phone=+50688887777`
- Por email: `GET /cards?email=cliente@email.com`

### ¿Necesito guardar logs de las transacciones?
Boomerangme guarda un historial completo. Puedes consultarlo con:
`GET /operations?cardId={card_id}`

---

## Soporte

- **Documentación Oficial:** https://docs.boomerangme.cards/api/api-docs
- **API Reference:** https://docs.digitalwallet.cards
- **Soporte Boomerangme:** Chat en el dashboard

---

## Resumen de Endpoints

| Acción | Método | Endpoint |
|--------|--------|----------|
| Consultar tarjeta | GET | `/cards/{id}` |
| Buscar por teléfono | GET | `/cards?phone={phone}` |
| Buscar por email | GET | `/cards?email={email}` |
| Agregar cashback | POST | `/cards/{id}/add-point` |
| Canjear cashback | POST | `/cards/{id}/subtract-point` |
| Ver operaciones | GET | `/operations?cardId={id}` |

---

*Documento generado para integración POS con Boomerangme API v2.0*
