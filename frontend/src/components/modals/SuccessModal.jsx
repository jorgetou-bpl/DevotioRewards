import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '../ui/button';

const SuccessModal = ({ isOpen, onClose, message }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="success-modal">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-4 sm:p-6 text-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-[#00C853] to-[#00E676] rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
        </div>
        <h3 className="text-heading text-lg sm:text-xl mb-2">Transacción Exitosa</h3>
        <p className="text-zinc-500 text-sm mb-6">{message}</p>
        
        <Button 
          onClick={onClose} 
          className="w-full h-10 sm:h-12 btn-primary" 
          data-testid="done-button"
        >
          Listo
        </Button>
      </div>
    </div>
  );
};

export default SuccessModal;
