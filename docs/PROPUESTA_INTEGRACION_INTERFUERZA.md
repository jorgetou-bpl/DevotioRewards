# Propuesta de Integración: POS InterFuerza → Devotio Rewards

## Automatización de Programa de Fidelidad (Cashback)

**Fecha**: Abril 2026
**Preparado por**: Devotio Rewards
**Para**: Cliente InterFuerza

---

## 1. Objetivo

Conectar su sistema POS InterFuerza con la plataforma de fidelidad Devotio Rewards para que cada vez que un cliente realice una compra, el sistema registre automáticamente el cashback correspondiente sin intervención manual.

**Resultado**: Sus clientes acumulan cashback de forma automática con cada compra facturada.

---

## 2. ¿Cómo Funciona?

```
Cliente paga en el POS
        │
        ▼
InterFuerza registra la factura
        │
        ▼
N8N detecta la nueva factura (cada 1-5 min)
        │
        ▼
Identifica al cliente por teléfono o email
        │
        ▼
Registra el cashback en Devotio Rewards
        │
        ▼
El cliente ve su saldo actualizado en su wallet digital
```

**No se requiere ningún cambio en su POS.** La integración funciona de forma externa leyendo las facturas ya generadas.

---

## 3. ¿Qué se Automatiza?

| Acción | Descripción |
|--------|-------------|
| **Agregar cashback** | Cada factura nueva acumula cashback automáticamente según el porcentaje configurado |
| **Identificación de cliente** | El sistema busca al cliente por teléfono, email o código de cliente |
| **Registro de referencia** | Cada transacción queda registrada con número de factura, monto y sucursal |

---

## 4. Datos que se Utilizan de InterFuerza

| Dato de la Factura | Uso |
|---------------------|-----|
| `Total` | Monto base para calcular el cashback |
| `Cliente` / `Nombre` | Identificar al cliente en el programa de fidelidad |
| `Telefono_1` / `Email` | Buscar la tarjeta de fidelidad del cliente |
| `id` (número de factura) | Referencia de la transacción |
| `Bodega` | Identificar la sucursal donde se realizó la compra |
| `Date` | Fecha de la transacción |

---

## 5. Requisitos Técnicos

| Requisito | Detalle | ¿Quién lo provee? |
|-----------|---------|-------------------|
| API Token de InterFuerza | Token con permisos de lectura de facturas y clientes | El cliente (desde Configuración → Apps → API) |
| API Key de Devotio Rewards | Clave para registrar cashback | Devotio |
| Instancia de N8N | Plataforma de automatización en la nube | Incluido en la propuesta |

---

## 6. Inversión

| Concepto | Costo | Frecuencia |
|----------|-------|------------|
| **Desarrollo e implementación** | $250 USD | Único (una vez) |
| **Plataforma N8N Cloud** | $24 USD/mes | Mensual |

### ¿Qué incluye el desarrollo?

- Configuración completa del flujo de automatización
- Conexión con API de InterFuerza (lectura de facturas)
- Conexión con API de Devotio Rewards (registro de cashback)
- Mapeo de clientes entre ambos sistemas
- Control de duplicados (una factura no se procesa dos veces)
- Pruebas con datos reales
- Soporte durante la puesta en marcha

### Costo mensual total: $24 USD/mes
### Inversión inicial: $250 USD (único)

---

## 7. Proceso de Implementación

| Paso | Descripción | Tiempo estimado |
|------|-------------|-----------------|
| 1 | Cliente proporciona API Token de InterFuerza | 1 día |
| 2 | Devotio configura el flujo en N8N | 2-3 días |
| 3 | Pruebas con facturas reales | 1-2 días |
| 4 | Ajustes y puesta en producción | 1 día |

**Tiempo total estimado: 5-7 días hábiles**

---

## 8. Consideraciones Importantes

- **No se modifica el POS**: InterFuerza sigue funcionando exactamente igual. La integración es externa.
- **Frecuencia de sincronización**: Las facturas se procesan cada 1-5 minutos. No es instantáneo, pero el cliente ve su cashback actualizado en minutos.
- **Rate limit de InterFuerza**: El API permite máximo 20 peticiones cada 10 segundos. El flujo está optimizado para respetar este límite.
- **Clientes nuevos**: Si un cliente del POS no tiene tarjeta de fidelidad, la transacción queda pendiente. Se puede configurar notificación para registrarlo.
- **Disponibilidad**: N8N Cloud tiene un SLA de 99.9% de uptime.

---

## 9. Próximos Pasos

1. **Confirmar** la propuesta
2. **Proveer** el API Token de InterFuerza con permisos de lectura
3. Devotio inicia la configuración
4. Pruebas conjuntas con facturas de prueba
5. Puesta en producción

---

## 10. Contacto

Para preguntas sobre esta propuesta, contacte a su representante de **Devotio Rewards**.
