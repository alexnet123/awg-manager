import * as React from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TabsContent } from '@/components/ui/tabs'

type LiveChartPoint = {
  slot: number
  pps: number
  bps: number
  ts: number
}

type Props = {
  hasSupport: (key: string) => boolean
  form: { counter?: boolean | null }
  setForm: React.Dispatch<React.SetStateAction<any>>
  formatCounter: (value?: number) => string
  formatBytesIEC: (bytes: number) => string
  formatBitrate: (bitsPerSec: number) => string
  formatPacketRate: (pps: number) => string
  currentRulePackets: number
  currentRuleBytes: number
  currentRuleBitrate: number
  currentRulePps: number
  statsChart: { points: LiveChartPoint[]; maxPps: number; maxBitsPerSec: number }
  statsSeries: 'packets' | 'bytes'
  setStatsSeries: React.Dispatch<React.SetStateAction<'packets' | 'bytes'>>
}

export function PolicyRuleEditorStatsTab(props: Props) {
  return (
    <TabsContent value='stats' className='mt-2 space-y-2.5'>
      {props.hasSupport('counter') ? <label className='flex items-center gap-2 text-xs'><input type='checkbox' className='h-4 w-4' checked={!!props.form.counter} onChange={(e) => props.setForm((p: any) => ({ ...p, counter: e.target.checked }))} />Enable nft `counter` for this rule</label> : null}
      <div className='grid grid-cols-2 gap-2'>
        <div className='space-y-1'>
          <Label className='text-[11px]'>packets</Label>
          <Input className='h-7 text-[12px]' disabled value={props.formatCounter(props.currentRulePackets)} />
        </div>
        <div className='space-y-1'>
          <Label className='text-[11px]'>bytes</Label>
          <Input className='h-7 text-[12px]' disabled value={props.formatBytesIEC(props.currentRuleBytes)} />
        </div>
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <div className='space-y-1'>
          <Label className='text-[11px]'>bit rate</Label>
          <Input className='h-7 text-[12px]' disabled value={props.formatBitrate(props.currentRuleBitrate)} />
        </div>
        <div className='space-y-1'>
          <Label className='text-[11px]'>packet rate</Label>
          <Input className='h-7 text-[12px]' disabled value={props.formatPacketRate(props.currentRulePps)} />
        </div>
      </div>
      <div className='rounded-md border p-2'>
        <div className='mb-2 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground'>
          <span>Current rule traffic</span>
          <span className='rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700'>live</span>
        </div>
        <div className='rounded-md border bg-muted/20 p-2'>
          <div className='h-28 w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={props.statsChart.points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='hsl(var(--border))' />
                <XAxis dataKey='slot' tickLine={false} axisLine={false} tick={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  width={60}
                  orientation='right'
                  domain={[0, props.statsSeries === 'packets' ? props.statsChart.maxPps : props.statsChart.maxBitsPerSec]}
                  tickFormatter={(v) => (
                    props.statsSeries === 'packets'
                      ? props.formatPacketRate(Number(v || 0))
                      : props.formatBitrate(Number(v || 0))
                  )}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as LiveChartPoint | undefined
                    return row?.ts ? new Date(row.ts).toLocaleTimeString() : ''
                  }}
                  formatter={(value, name) => [
                    name === 'pps'
                      ? props.formatPacketRate(Number(value || 0))
                      : props.formatBitrate(Number(value || 0)),
                    name === 'pps' ? 'packet rate' : 'bit rate',
                  ]}
                />
                {props.statsSeries === 'bytes' ? <Line type='linear' dataKey={(x: LiveChartPoint) => x.bps * 8} stroke='#2563eb' strokeWidth={2} dot={false} isAnimationActive={false} /> : null}
                {props.statsSeries === 'packets' ? <Line type='linear' dataKey='pps' stroke='#2563eb' strokeWidth={2} dot={false} isAnimationActive={false} /> : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {!props.form.counter ? (
            <div className='mt-1 rounded border border-dashed px-2 py-1 text-[10px] text-muted-foreground'>
              Counter disabled: enable `nft counter` to collect live chart data.
            </div>
          ) : null}
          <div className='mt-2 flex items-center justify-between text-[10px]'>
            <div className='flex items-center gap-2'>
              <button type='button' className={`rounded border px-2 py-1 ${props.statsSeries === 'packets' ? 'border-blue-600 bg-blue-600 text-white' : 'border-border bg-background text-muted-foreground'}`} onClick={() => props.setStatsSeries('packets')}>Packet rate</button>
              <button type='button' className={`rounded border px-2 py-1 ${props.statsSeries === 'bytes' ? 'border-blue-600 bg-blue-600 text-white' : 'border-border bg-background text-muted-foreground'}`} onClick={() => props.setStatsSeries('bytes')}>Bit rate</button>
            </div>
            <div className='text-[11px] text-muted-foreground'>
              {props.statsSeries === 'bytes'
                ? <>Bit rate: <span className='font-medium text-foreground'>{props.formatBitrate(props.currentRuleBitrate)}</span></>
                : <>Packet Rate: <span className='font-medium text-foreground'>{props.formatPacketRate(props.currentRulePps)}</span></>}
            </div>
          </div>
        </div>
      </div>
    </TabsContent>
  )
}
