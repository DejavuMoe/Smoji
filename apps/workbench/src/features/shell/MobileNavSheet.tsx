import { X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet'
import { useWorkbench } from '../../app/WorkbenchContext'
import { SidebarContent } from './Sidebar'

export function MobileNavSheet() {
  const { mobileDrawerOpen, setMobileDrawerOpen } = useWorkbench()

  return (
    <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
      <SheetContent
        side="left"
        className="w-[min(88vw,340px)] p-4 sm:p-5"
        aria-label="分类导航"
      >
        <SheetHeader className="mb-3 flex flex-row items-center justify-between">
          <SheetTitle className="text-sm font-semibold text-foreground">
            工作区分类
          </SheetTitle>
          <button
            id="sidebar-close"
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="关闭侧边栏"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>
        <div className="h-[calc(100%-3rem)] overflow-y-auto">
          <SidebarContent />
        </div>
      </SheetContent>
    </Sheet>
  )
}
