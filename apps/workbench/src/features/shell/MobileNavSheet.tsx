import { Button } from '../../components/ui/button'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet'
import { useWorkbench } from '../../app/WorkbenchContext'
import { useMediaQuery } from '../../hooks/use-media-query'
import { useFocusReturn } from '../../focus-return'
import { SidebarContent } from './Sidebar'

export function MobileNavSheet() {
  const { mobileDrawerOpen, setMobileDrawerOpen } = useWorkbench()
  const isDesktop = useMediaQuery('(min-width: 901px)')

  // Crossing into the desktop breakpoint must unmount the sheet: two workspace IDs may never coexist.
  useEffect(() => {
    if (isDesktop && mobileDrawerOpen) setMobileDrawerOpen(false)
  }, [isDesktop, mobileDrawerOpen, setMobileDrawerOpen])

  const focusReturn = useFocusReturn('#grid', '#menu-toggle')

  return (
    <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
      <SheetContent {...focusReturn}
        id="mobile-sidebar"
        side="left"
        showCloseButton={false}
        style={{ width: 'min(88vw,340px)' }}
        className="p-4 sm:p-5"
        aria-label="分类导航"
      >
        <SheetHeader className="mb-3 flex flex-row items-center justify-between">
          <SheetTitle className="text-sm font-semibold text-foreground">
            工作区分类
          </SheetTitle>
          <Button variant="ghost"
            id="sidebar-close"
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="关闭侧边栏"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>
        <div className="flex-1 min-h-0 flex flex-col">
          {!isDesktop && <SidebarContent />}
        </div>
      </SheetContent>
    </Sheet>
  )
}
