import React from 'react';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
            <FileQuestion className="w-12 h-12 text-zinc-600" />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-8xl font-black tracking-tight text-zinc-900">404</h1>
          <h2 className="text-3xl font-bold tracking-tight">Page Not Found</h2>
          <p className="text-zinc-400 text-lg leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <button
            onClick={() => window.location.href = '/'}
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-500 text-white font-bold rounded-full hover:bg-red-600 transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </button>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white font-bold rounded-full hover:bg-zinc-800 transition-colors border border-zinc-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>

        <div className="pt-8 border-t border-zinc-900">
          <p className="text-sm text-zinc-600">
            Need help? Contact us at{' '}
            <a href="mailto:sakthivel.b3p@gmail.com" className="text-red-500 hover:text-red-400 transition-colors">
              sakthivel.b3p@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
