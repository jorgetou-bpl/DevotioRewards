import { 
  Stamp, 
  Gift, 
  Star, 
  CreditCard, 
  Percent, 
  Ticket, 
  Wallet, 
  User 
} from 'lucide-react';

// Card type configurations - Spanish
// Boomerang API card types: stamp(0), cashback(1), multipass(2), coupon(3), discount(4), gift(5), membership(6), reward(7)
export const CARD_TYPE_CONFIG = {
  // Stamp card (type ID 0)
  stamp: {
    name: 'Tarjeta de Sellos',
    icon: Stamp,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Sellos', endpoint: 'add-stamp' },
      canjear: { label: 'Canjear Recompensa', endpoint: 'subtract-reward' }
    }
  },
  stamp_card: { // Alias for demo cards
    name: 'Tarjeta de Sellos',
    icon: Stamp,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Sellos', endpoint: 'add-stamp' },
      canjear: { label: 'Canjear Recompensa', endpoint: 'subtract-reward' }
    }
  },
  // Cashback card (type ID 1)
  cashback: {
    name: 'Tarjeta Cashback',
    icon: Wallet,
    color: '#F040A0',
    tabs: ['Agregar', 'Canjear'],
    requiresPurchaseAmount: true,
    actions: {
      agregar: { label: 'Agregar Cashback', endpoint: 'add-point', amountLabel: 'Ingrese monto de compra' },
      canjear: { label: 'Canjear Saldo', endpoint: 'subtract-point' }
    }
  },
  cashback_card: { // Alias for demo cards
    name: 'Tarjeta Cashback',
    icon: Wallet,
    color: '#F040A0',
    tabs: ['Agregar', 'Canjear'],
    requiresPurchaseAmount: true,
    actions: {
      agregar: { label: 'Agregar Cashback', endpoint: 'add-point', amountLabel: 'Ingrese monto de compra' },
      canjear: { label: 'Canjear Saldo', endpoint: 'subtract-point' }
    }
  },
  // Multipass card (type ID 2) - Boomerang API returns "subscription" type
  multipass: {
    name: 'Multipase',
    icon: CreditCard,
    color: '#8A2BE2',
    tabs: ['Visitas', 'Puntos'],
    actions: {
      visitas: { label: 'Visitas', endpoint: null },
      puntos: { label: 'Canjear Puntos', endpoint: 'subtract-point' }
    },
    subActions: {
      visitas: {
        agregar: { label: 'Agregar Visitas', endpoint: 'add-visit' },
        canjear: { label: 'Canjear Visitas', endpoint: 'subtract-visit' }
      }
    }
  },
  subscription: {
    name: 'Multipase',
    icon: CreditCard,
    color: '#8A2BE2',
    tabs: ['Visitas', 'Puntos'],
    actions: {
      visitas: { label: 'Visitas', endpoint: null },
      puntos: { label: 'Canjear Puntos', endpoint: 'subtract-point' }
    },
    subActions: {
      visitas: {
        agregar: { label: 'Agregar Visitas', endpoint: 'add-visit' },
        canjear: { label: 'Canjear Visitas', endpoint: 'subtract-visit' }
      }
    }
  },
  // Coupon (type ID 3)
  coupon: {
    name: 'Cupón',
    icon: Ticket,
    color: '#F040A0',
    tabs: ['Usar'],
    singleUse: true,
    requiresPurchaseAmount: true,
    actions: {
      usar: { label: 'Usar Cupón', endpoint: 'use-coupon', amountLabel: 'Monto de compra' }
    }
  },
  // Discount card (type ID 4)
  discount: {
    name: 'Tarjeta de Descuento',
    icon: Percent,
    color: '#F040A0',
    tabs: ['Aplicar'],
    requiresPurchaseAmount: true,
    actions: {
      aplicar: { label: 'Aplicar Descuento', endpoint: 'add-point', amountLabel: 'Ingrese monto de compra' }
    }
  },
  discount_card: {
    name: 'Tarjeta de Descuento',
    icon: Percent,
    color: '#F040A0',
    tabs: ['Aplicar'],
    requiresPurchaseAmount: true,
    actions: {
      aplicar: { label: 'Aplicar Descuento', endpoint: 'add-point', amountLabel: 'Ingrese monto de compra' }
    }
  },
  // Gift card (type ID 5) - Boomerang API returns "certificate" type
  gift: {
    name: 'Tarjeta de Regalo',
    icon: Gift,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Saldo', endpoint: 'add-point' },
      canjear: { label: 'Canjear Saldo', endpoint: 'subtract-point' }
    }
  },
  certificate: {
    name: 'Tarjeta de Regalo',
    icon: Gift,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Saldo', endpoint: 'add-point' },
      canjear: { label: 'Canjear Saldo', endpoint: 'subtract-point' }
    }
  },
  gift_card: {
    name: 'Tarjeta de Regalo',
    icon: Gift,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Saldo', endpoint: 'add-point' },
      canjear: { label: 'Canjear Saldo', endpoint: 'subtract-point' }
    }
  },
  // Membership card (type ID 6) - Only redeem visits, no add functionality
  membership: {
    name: 'Membresía',
    icon: User,
    color: '#8A2BE2',
    tabs: ['Canjear'], // Only redeem - membership visits are pre-configured
    actions: {
      canjear: { label: 'Canjear Visita', endpoint: 'subtract-visit' }
    }
  },
  membership_card: {
    name: 'Membresía',
    icon: User,
    color: '#8A2BE2',
    tabs: ['Canjear'], // Only redeem - membership visits are pre-configured
    actions: {
      canjear: { label: 'Canjear Visita', endpoint: 'subtract-visit' }
    }
  },
  // Reward card (type ID 7)
  reward: {
    name: 'Tarjeta de Recompensa',
    icon: Star,
    color: '#F040A0',
    tabs: ['Agregar', 'Canjear'],
    requiresPurchaseAmount: true,
    actions: {
      agregar: { label: 'Agregar Puntos', endpoint: 'add-scores', amountLabel: 'Monto de compra' },
      canjear: { label: 'Canjear Recompensa', endpoint: 'receive-reward' }
    }
  },
  reward_card: {
    name: 'Tarjeta de Recompensa',
    icon: Star,
    color: '#F040A0',
    tabs: ['Agregar', 'Canjear'],
    requiresPurchaseAmount: true,
    actions: {
      agregar: { label: 'Agregar Puntos', endpoint: 'add-scores', amountLabel: 'Monto de compra' },
      canjear: { label: 'Canjear Recompensa', endpoint: 'receive-reward' }
    }
  },
  // Legacy/demo card types
  points_card: {
    name: 'Tarjeta de Puntos',
    icon: Star,
    color: '#F040A0',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Puntos', endpoint: 'add-point' },
      canjear: { label: 'Canjear Recompensa', endpoint: 'redeem-reward' }
    }
  },
  vip_card: {
    name: 'Tarjeta VIP',
    icon: Star,
    color: '#8A2BE2',
    tabs: ['Agregar', 'Canjear'],
    actions: {
      agregar: { label: 'Agregar Puntos', endpoint: 'add-point' },
      canjear: { label: 'Canjear Recompensa', endpoint: 'redeem-reward' }
    }
  }
};

// Helper to normalize card type from API response
export const normalizeCardType = (type) => {
  if (!type) return null;
  const normalizedType = type.toLowerCase().replace('_card', '');
  const typeMap = { 0: 'stamp', 1: 'cashback', 2: 'multipass', 3: 'coupon', 4: 'discount', 5: 'gift', 6: 'membership', 7: 'reward' };
  if (typeMap[normalizedType]) return typeMap[normalizedType];
  return normalizedType;
};

// Format action title for display
export const formatActionTitle = (action) => {
  if (!action) return '';
  const titles = {
    'agregarvisitas': 'Agregar Visitas',
    'canjearvisitas': 'Canjear Visitas',
    'agregarpuntos': 'Agregar Puntos',
    'canjearpuntos': 'Canjear Puntos',
    'agregar': 'Agregar',
    'canjear': 'Canjear',
    'usar': 'Usar Cupón'
  };
  return titles[action.toLowerCase()] || action;
};
