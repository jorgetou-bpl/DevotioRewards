import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import {
  ArrowLeft,
  Mail,
  MessageCircle,
  FileText,
  ExternalLink,
  HelpCircle
} from 'lucide-react';

const SupportPage = () => {
  const navigate = useNavigate();

  const supportItems = [
    {
      icon: FileText,
      title: 'Documentación',
      description: 'Lee la guía de usuario y preguntas frecuentes',
      action: () => window.open('https://devotiorewards.com/', '_blank'),
      testId: 'support-docs'
    },
    {
      icon: Mail,
      title: 'Soporte por Correo',
      description: 'Contáctanos en contacto@devotiorewards.com',
      action: () => window.location.href = 'mailto:contacto@devotiorewards.com',
      testId: 'support-email'
    },
    {
      icon: MessageCircle,
      title: 'Chat en Vivo',
      description: 'Chatea con nuestro equipo de soporte',
      action: () => window.open('https://devotiorewards.com/', '_blank'),
      testId: 'support-chat'
    }
  ];

  const faqItems = [
    {
      question: '¿Por qué la información del cliente está oculta?',
      answer: 'Esta aplicación de escáner está diseñada para proteger la privacidad del cliente. Información personal como correos y teléfonos están enmascarados para cumplir con políticas de protección de datos. El nombre del cliente sí es visible para facilitar la identificación.'
    },
    {
      question: '¿Cómo escaneo una tarjeta?',
      answer: 'Presiona el botón "Escanear" en la pantalla principal y apunta tu cámara al código de barras o código QR del pase de billetera digital del cliente.'
    },
    {
      question: '¿Qué acciones puedo realizar?',
      answer: 'Puedes agregar sellos, agregar puntos o canjear recompensas dependiendo del tipo de tarjeta de fidelidad que tenga el cliente.'
    }
  ];

  return (
    <div className="min-h-screen bg-white" data-testid="support-page">
      {/* Header */}
      <header className="nav-header">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="h-5 w-5 text-[#2E0854]" />
          <span className="font-medium text-[#2E0854]">Volver</span>
        </button>
        <img 
          src="/fonts/logo.png" 
          alt="Devotio Rewards" 
          className="h-10"
        />
        <div className="w-20" />
      </header>

      <main className="max-w-md mx-auto p-6">
        <h2 className="text-heading text-3xl text-center mb-2" data-testid="support-title">
          Soporte
        </h2>
        <p className="text-center text-zinc-500 text-sm mb-8">
          ¿Cómo podemos ayudarte hoy?
        </p>

        {/* Support Options */}
        <div className="space-y-4 mb-8">
          {supportItems.map((item) => (
            <button
              key={item.testId}
              onClick={item.action}
              className="card-brutalist w-full text-left hover:-translate-y-1 hover:shadow-xl transition-all"
              data-testid={item.testId}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-[#F040A0] to-[#8A2BE2] rounded-lg flex items-center justify-center">
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#2E0854]">{item.title}</p>
                  <p className="text-sm text-zinc-500">{item.description}</p>
                </div>
                <ExternalLink className="h-5 w-5 text-zinc-400" />
              </div>
            </button>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="card-brutalist">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="h-5 w-5 text-[#8A2BE2]" />
            <h3 className="font-semibold uppercase tracking-wider text-sm text-[#2E0854]">
              Preguntas Frecuentes
            </h3>
          </div>

          <div className="space-y-4">
            {faqItems.map((faq, index) => (
              <div key={index} className="border-b border-zinc-200 pb-4 last:border-0 last:pb-0">
                <p className="font-medium mb-2 text-[#2E0854]" data-testid={`faq-question-${index}`}>
                  {faq.question}
                </p>
                <p className="text-sm text-zinc-500" data-testid={`faq-answer-${index}`}>
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Version Info */}
        <div className="text-center mt-8 text-zinc-400 text-sm">
          <p>Devotio Rewards Scanner v1.0.0</p>
          <p className="mt-1">Powered by Devotio Rewards</p>
        </div>
      </main>
    </div>
  );
};

export default SupportPage;
