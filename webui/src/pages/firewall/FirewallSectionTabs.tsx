import * as React from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type FirewallSectionTab = 'policy' | 'collections' | 'objects' | 'table_builder'

type Props = {
  activeSection: FirewallSectionTab
  setActiveSection: React.Dispatch<React.SetStateAction<FirewallSectionTab>>
  onSectionChange?: (next: FirewallSectionTab) => void
}

export function FirewallSectionTabs(props: Props) {
  return (
    <Tabs
      value={props.activeSection}
      onValueChange={(v) => {
        const next = v as FirewallSectionTab
        props.setActiveSection(next)
        props.onSectionChange?.(next)
      }}
    >
      <TabsList className='h-9'>
        <TabsTrigger className='px-4 text-sm' value='policy'>policy</TabsTrigger>
        <TabsTrigger className='px-4 text-sm' value='collections'>collections</TabsTrigger>
        <TabsTrigger className='px-4 text-sm' value='objects'>objects</TabsTrigger>
        <TabsTrigger className='px-4 text-sm' value='table_builder'>table builder</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
