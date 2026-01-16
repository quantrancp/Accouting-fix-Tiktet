
import React from 'react';
import { ErrorStatus, ErrorPriority } from '../types';

interface BadgeProps {
  type: 'status' | 'priority';
  value: string;
}

const StatusBadge: React.FC<BadgeProps> = ({ type, value }) => {
  const getColors = () => {
    if (type === 'status') {
      switch (value) {
        case ErrorStatus.PENDING: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case ErrorStatus.PROCESSING: return 'bg-blue-100 text-blue-800 border-blue-200';
        case ErrorStatus.FIXED: return 'bg-green-100 text-green-800 border-green-200';
        case ErrorStatus.REJECTED: return 'bg-red-100 text-red-800 border-red-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    } else {
      switch (value) {
        case ErrorPriority.LOW: return 'bg-slate-100 text-slate-800 border-slate-200';
        case ErrorPriority.MEDIUM: return 'bg-cyan-100 text-cyan-800 border-cyan-200';
        case ErrorPriority.HIGH: return 'bg-orange-100 text-orange-800 border-orange-200';
        case ErrorPriority.URGENT: return 'bg-rose-100 text-rose-800 border-rose-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    }
  };

  const getLabel = () => {
    if (type === 'status') {
      switch (value) {
        case ErrorStatus.PENDING: return 'Chờ xử lý';
        case ErrorStatus.PROCESSING: return 'Đang xử lý';
        case ErrorStatus.FIXED: return 'Đã xong';
        case ErrorStatus.REJECTED: return 'Từ chối';
        default: return value;
      }
    }
    return value;
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getColors()}`}>
      {getLabel()}
    </span>
  );
};

export default StatusBadge;
