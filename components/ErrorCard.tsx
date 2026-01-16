
import React from 'react';
import { AccountingError } from '../types';
import StatusBadge from './StatusBadge';

interface ErrorCardProps {
  error: AccountingError;
  onClick: (error: AccountingError) => void;
}

const ErrorCard: React.FC<ErrorCardProps> = ({ error, onClick }) => {
  return (
    <div 
      onClick={() => onClick(error)}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
          {error.title}
        </h3>
        <StatusBadge type="priority" value={error.priority} />
      </div>
      
      <p className="text-gray-600 text-sm line-clamp-2 mb-4 h-10">
        {error.description}
      </p>
      
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50 text-xs text-gray-500">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-gray-700">{error.category}</span>
          <span>{new Date(error.createdAt).toLocaleDateString('vi-VN')}</span>
        </div>
        <StatusBadge type="status" value={error.status} />
      </div>
    </div>
  );
};

export default ErrorCard;
