import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PencilIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import api from '../../api'
import MetricWidget from './widgets/MetricWidget'
import ChartWidget from './widgets/ChartWidget'
import TableWidget from './widgets/TableWidget'
import GaugeWidget from './widgets/GaugeWidget'
import SQLWidget from './widgets/SQLWidget'
import type { Widget, WidgetData } from './types'

interface WidgetWrapperProps {
  widget: Widget
  isEditing: boolean
  onEdit: () => void
  onDelete: () => void
  departmentFilter?: string
}

export default function WidgetWrapper({ widget, isEditing, onEdit, onDelete, departmentFilter }: WidgetWrapperProps) {
  const [isHovered, setIsHovered] = useState(false)

  const configWithFilter = departmentFilter
    ? { ...widget.config, department: departmentFilter }
    : widget.config

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['widget-data', widget.id, widget.type, configWithFilter],
    queryFn: async () => {
      const response = await api.post('/widgets/data', {
        widget_type: widget.type,
        config: configWithFilter,
      })
      return response.data.data as WidgetData
    },
    staleTime: 60000, // 1 minute
  })

  const renderWidget = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      )
    }

    if (!data) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          No data available
        </div>
      )
    }

    switch (widget.type) {
      case 'metric':
        return <MetricWidget data={data} config={widget.config} />
      case 'line':
      case 'bar':
      case 'area':
      case 'pie':
        return <ChartWidget type={widget.type} data={data} config={widget.config} />
      case 'table':
        return <TableWidget data={data} config={widget.config} />
      case 'gauge':
        return <GaugeWidget data={data} config={widget.config} />
      case 'sql':
        return <SQLWidget config={widget.config} />
      default:
        return <div>Unknown widget type</div>
    }
  }

  return (
    <div
      className="h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700 truncate">{widget.title}</h3>
        <div
          className={`widget-actions flex items-center gap-1 transition-opacity ${
            isHovered || isEditing ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              refetch()
            }}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="Refresh"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-1 text-gray-400 hover:text-primary-600 rounded"
            title="Edit"
          >
            <PencilIcon className="w-4 h-4" />
          </button>
          {isEditing && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-1 text-gray-400 hover:text-danger-600 rounded"
              title="Delete"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">{renderWidget()}</div>
    </div>
  )
}
