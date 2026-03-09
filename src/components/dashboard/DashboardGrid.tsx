import { useMemo } from 'react'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import WidgetWrapper from './WidgetWrapper'
import type { Widget, DashboardLayout } from './types'

interface DashboardGridProps {
  widgets: Widget[]
  layout: DashboardLayout[]
  isEditing: boolean
  onLayoutChange: (layout: DashboardLayout[]) => void
  onEditWidget: (widgetId: string) => void
  onDeleteWidget: (widgetId: string) => void
  departmentFilter?: string
}

export default function DashboardGrid({
  widgets,
  layout,
  isEditing,
  onLayoutChange,
  onEditWidget,
  onDeleteWidget,
  departmentFilter,
}: DashboardGridProps) {
  const gridLayout = useMemo(() => {
    return layout.map((item) => ({
      ...item,
      static: !isEditing,
    }))
  }, [layout, isEditing])

  const handleLayoutChange = (newLayout: GridLayout.Layout[]) => {
    const updatedLayout: DashboardLayout[] = newLayout.map((item) => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      minH: item.minH,
    }))
    onLayoutChange(updatedLayout)
  }

  return (
    <div className={`dashboard-grid ${isEditing ? 'editing' : ''}`}>
      <GridLayout
        className="layout"
        layout={gridLayout}
        cols={12}
        rowHeight={80}
        width={1200}
        onLayoutChange={handleLayoutChange}
        isDraggable={isEditing}
        isResizable={isEditing}
        compactType="vertical"
        preventCollision={false}
        margin={[16, 16]}
        draggableCancel=".widget-actions"
      >
        {widgets.map((widget) => (
          <div key={widget.id} className="widget-container">
            <WidgetWrapper
              widget={widget}
              isEditing={isEditing}
              onEdit={() => onEditWidget(widget.id)}
              onDelete={() => onDeleteWidget(widget.id)}
              departmentFilter={departmentFilter}
            />
          </div>
        ))}
      </GridLayout>

      <style>{`
        .dashboard-grid.editing .widget-container {
          cursor: move;
        }
        .dashboard-grid .react-grid-item.react-grid-placeholder {
          background: rgb(59 130 246 / 0.2);
          border: 2px dashed rgb(59 130 246);
          border-radius: 8px;
        }
        .dashboard-grid .react-resizable-handle {
          background: none;
        }
        .dashboard-grid .react-resizable-handle::after {
          content: '';
          position: absolute;
          right: 3px;
          bottom: 3px;
          width: 8px;
          height: 8px;
          border-right: 2px solid rgba(0,0,0,0.3);
          border-bottom: 2px solid rgba(0,0,0,0.3);
        }
        .widget-container {
          height: 100%;
        }
      `}</style>
    </div>
  )
}
