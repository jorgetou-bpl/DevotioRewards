# Propuesta de Integración: POS Contífico → Devotio Rewards

## Automatización de Programa de Fidelidad (Cashback)

**Fecha**: Abril 2026
**Preparado por**: Devotio Rewards
**Para**: Cliente Contífico

---

## 1. Objetivo

Conectar su sistema contable/POS Contífico con la plataforma de fidelidad Devotio Rewards para que cada vez que un cliente realice una compra, el sistema registre automáticamente el cashback correspondiente sin intervención manual.

**Resultado**: Sus clientes acumulan cashback de forma automática con cada factura emitida.

---

## 2. ¿Cómo Funciona?

```
Cliente paga en el POS
        │
        ▼
Contífico registra la factura
        │
        ▼
N8N detecta la nueva factura (cada 1-5 min)
        │
        ▼
Identifica al cliente por cédula, teléfono o email
        │
        ▼
Registra el cashback en Devotio Rewards
        │
        ▼
El cliente ve su saldo actualizado en su wallet digital
```

**No se requiere ningún cambio en su sistema.** La integración funciona de forma externa leyendo las facturas ya generadas.

---

## 3. ¿Qué se Automatiza?

| Acción | Descripción |
|--------|-------------|
| **Agregar cashback** | Cada factura nueva acumula cashback automáticamente según el porcentaje configurado |
| **Identificación de cliente** | El sistema busca al cliente por cédula, teléfono o email |
| **Registro de referencia** | Cada transacción queda registrada con número de documento, monto y fecha |

---

## 4. Datos que se Utilizan de Contífico

| Dato de la Factura | Uso |
|---------------------|-----|
| `total` | Monto base para calcular el cashback |
| `persona.cedula` | Identificar al cliente en el programa de fidelidad |
| `persona.telefonos` / `persona.email` | Búsqueda alternativa del cliente |
| `persona.razon_social` | Nombre del cliente para referencia |
| `documento` (número de factura) | Referencia de la transacción |
| `fecha_emision` | Fecha de la transacción |

---

## 5. Requisitos Técnicos

| Requisito | Detalle | ¿Quién lo provee? |
|-----------|---------|-------------------|
| API Key de Contífico | Clave de acceso a la API con permisos de lectura de documentos y personas | El cliente (solicitar a soporte Contífico) |
| API Token de Contífico | Token del POS para autenticación | El cliente |
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
- Conexión con API v2 de Contífico (lectura de facturas y personas)
- Conexión con API de Devotio Rewards (registro de cashback)
- Mapeo de clientes por cédula, teléfono o email
- Control de duplicados (una factura no se procesa dos veces)
- Pruebas con datos reales
- Soporte durante la puesta en marcha

### Costo mensual total: $24 USD/mes
### Inversión inicial: $250 USD (único)

---

## 7. Proceso de Implementación

| Paso | Descripción | Tiempo estimado |
|------|-------------|-----------------|
| 1 | Cliente proporciona API Key y Token de Contífico | 1 día |
| 2 | Devotio configura el flujo en N8N | 2-3 días |
| 3 | Pruebas con facturas reales | 1-2 días |
| 4 | Ajustes y puesta en producción | 1 día |

**Tiempo total estimado: 5-7 días hábiles**

---

## 8. Consideraciones Importantes

- **No se modifica Contífico**: Su sistema sigue funcionando exactamente igual. La integración es externa y solo lee datos.
- **Frecuencia de sincronización**: Las facturas se procesan cada 1-5 minutos. El cliente ve su cashback actualizado en minutos.
- **Solo facturas (FAC)**: El sistema solo procesa documentos tipo Factura. Notas de crédito, cotizaciones u otros documentos se ignoran.
- **Clientes nuevos**: Si un cliente de Contífico no tiene tarjeta de fidelidad, la transacción queda pendiente. Se puede configurar notificación para registrarlo.
- **Disponibilidad**: N8N Cloud tiene un SLA de 99.9% de uptime.

---

## 9. Próximos Pasos

1. **Confirmar** la propuesta
2. **Proveer** el API Key y Token de Contífico
3. Devotio inicia la configuración
4. Pruebas conjuntas con facturas reales
5. Puesta en producción

---

## 10. Contacto

Para preguntas sobre esta propuesta, contacte a su representante de **Devotio Rewards**.
