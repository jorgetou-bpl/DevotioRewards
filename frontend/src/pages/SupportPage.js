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
      title: 'Documentation',
      description: 'Read the user guide and FAQs',
      action: () => window.open('https://docs.boomerangme.cards/', '_blank'),
      testId: 'support-docs'
    },
    {
      icon: Mail,
      title: 'Email Support',
      description: 'Contact us at support@boomerangme.cards',
      action: () => window.location.href = 'mailto:support@boomerangme.cards',
      testId: 'support-email'
    },
    {
      icon: MessageCircle,
      title: 'Live Chat',
      description: 'Chat with our support team',
      action: () => window.open('https://boomerangme.cards/', '_blank'),
      testId: 'support-chat'
    }
  ];

  const faqItems = [
    {
      question: 'Why is customer information hidden?',
      answer: 'This scanner app is designed to protect customer privacy. Personal information like names, emails, and phone numbers are masked to comply with data protection policies.'
    },
    {
      question: 'How do I scan a card?',
      answer: 'Tap the "Scan" button on the home screen and point your camera at the QR code on the customer\'s digital wallet pass.'
    },
    {
      question: 'What actions can I perform?',
      answer: 'You can add stamps, add points, or redeem rewards depending on the type of loyalty card the customer has.'
    }
  ];

  return (
    <div className="min-h-screen bg-white" data-testid="support-page">
      {/* Header */}
      <header className="nav-header">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 p-2 hover:bg-zinc-100 rounded-sm transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Back</span>
        </button>
        <h1 className="logo-text text-xl">Boomerang</h1>
        <div className="w-20" />
      </header>

      <main className="max-w-md mx-auto p-6">
        <h2 className="text-heading text-3xl text-center mb-2" data-testid="support-title">
          Support
        </h2>
        <p className="text-center text-zinc-500 text-sm mb-8">
          How can we help you today?
        </p>

        {/* Support Options */}
        <div className="space-y-4 mb-8">
          {supportItems.map((item) => (
            <button
              key={item.testId}
              onClick={item.action}
              className="card-brutalist w-full text-left hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)] transition-all"
              data-testid={item.testId}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-100 rounded-sm flex items-center justify-center">
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{item.title}</p>
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
            <HelpCircle className="h-5 w-5" />
            <h3 className="font-bold uppercase tracking-wider text-sm">
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-4">
            {faqItems.map((faq, index) => (
              <div key={index} className="border-b border-zinc-200 pb-4 last:border-0 last:pb-0">
                <p className="font-medium mb-2" data-testid={`faq-question-${index}`}>
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
          <p>Scanner App v1.0.0</p>
          <p className="mt-1">Powered by Boomerang API</p>
        </div>
      </main>
    </div>
  );
};

export default SupportPage;
