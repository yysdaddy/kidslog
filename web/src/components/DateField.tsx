import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 统一的日期 / 日期时间选择器
 * - 值格式：date -> 'YYYY-MM-DD'，datetime -> 'YYYY-MM-DDTHH:mm'
 * - 支持快速跳年、跳月，避免原生 input 在 WebView 里逐月翻页
 */
export type DateFieldProps = {
  value: string;
  onChange: (v: string) => void;
  mode?: 'date' | 'datetime';
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const pad2 = (n: number) => String(n).padStart(2, '0');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function clamp(v: string, min?: string, max?: string) {
  if (min && v < min) return min;
  if (max && v > max) return max;
  return v;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

function weekdayOf(dateStr: string) {
  const y = Number(dateStr.slice(0, 4));
  const m = Number(dateStr.slice(5, 7));
  const d = Number(dateStr.slice(8, 10));
  return WEEK[new Date(y, m - 1, d).getDay()];
}

function displayText(value: string, mode: 'date' | 'datetime') {
  if (!value || value.length < 10) return '';
  const y = value.slice(0, 4);
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  const base = `${y}年${m}月${d}日 周${weekdayOf(value)}`;
  if (mode === 'datetime' && value.includes('T')) return `${base} ${value.slice(11, 16)}`;
  return base;
}

export default function DateField({
  value,
  onChange,
  mode = 'date',
  min,
  max,
  disabled,
  className = '',
  placeholder = '选择日期',
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [day, setDay] = useState(new Date().getDate());
  const [time, setTime] = useState('08:00');
  const [pickYear, setPickYear] = useState(false);
  const [yearBase, setYearBase] = useState(Math.floor(new Date().getFullYear() / 10) * 10);

  const draft = `${year}-${pad2(month)}-${pad2(day)}`;

  // 打开时用当前值初始化草稿
  useEffect(() => {
    if (!open) return;
    const initial = clamp(value && value.length >= 10 ? value.slice(0, 10) : todayStr(), min, max);
    setYear(Number(initial.slice(0, 4)));
    setMonth(Number(initial.slice(5, 7)));
    setDay(Number(initial.slice(8, 10)));
    if (mode === 'datetime') {
      setTime(value && value.includes('T') ? value.slice(11, 16) : '08:00');
    }
    setPickYear(false);
    setYearBase(Math.floor(Number(initial.slice(0, 4)) / 10) * 10);
  }, [open]);

  const begin = Number(draft.slice(0, 4));
  const firstWeekday = new Date(begin, month - 1, 1).getDay();
  const total = daysInMonth(year, month);

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= total; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isBlocked = (d: number) => {
    const s = `${year}-${pad2(month)}-${pad2(d)}`;
    if (min && s < min) return true;
    if (max && s > max) return true;
    return false;
  };

  const shiftMonth = (delta: number) => {
    const idx = year * 12 + (month - 1) + delta;
    const ny = Math.floor(idx / 12);
    const nm = (idx % 12) + 1;
    setYear(ny);
    setMonth(nm);
    // 切换月份后把日号收敛到该月天数，避免 31 号落到 2 月
    if (day > daysInMonth(ny, nm)) setDay(daysInMonth(ny, nm));
    setPickYear(false);
  };

  const commit = () => {
    const finalDay = Math.min(day, daysInMonth(year, month));
    const dstr = `${year}-${pad2(month)}-${pad2(finalDay)}`;
    onChange(mode === 'datetime' ? `${dstr}T${time}` : dstr);
    setOpen(false);
  };

  const quick = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const s = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setDay(d.getDate());
    setPickYear(false);
  };

  const years: number[] = [];
  for (let yi = yearBase; yi < yearBase + 12; yi += 1) years.push(yi);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 text-left disabled:opacity-60 ${className}`}
      >
        <CalendarDays size={15} className="shrink-0 text-brand-400" />
        <span className={value ? '' : 'text-slate-300'}>{value ? displayText(value, mode) : placeholder}</span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-xl pb-[env(safe-area-inset-bottom)]">
            {/* 年月快速切换 */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <button type="button" onClick={() => shiftMonth(-1)} className="p-2 rounded-full bg-slate-50 text-slate-500">
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setPickYear((v) => !v)}
                className="px-4 py-1.5 rounded-full bg-brand-50 text-brand-700 text-sm font-semibold"
              >
                {year}年 {month}月
                <span className="ml-1 text-[10px] text-brand-400">{pickYear ? '收起' : '换年'}</span>
              </button>
              <button type="button" onClick={() => shiftMonth(1)} className="p-2 rounded-full bg-slate-50 text-slate-500">
                <ChevronRight size={18} />
              </button>
            </div>

            {pickYear ? (
              <div className="px-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <button type="button" onClick={() => setYearBase((v) => v - 12)} className="p-1.5 rounded-lg bg-slate-50 text-slate-500">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-slate-400">{yearBase} — {yearBase + 11}</span>
                  <button type="button" onClick={() => setYearBase((v) => v + 12)} className="p-1.5 rounded-lg bg-slate-50 text-slate-500">
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {years.map((yi) => (
                    <button
                      key={yi}
                      type="button"
                      onClick={() => {
                        setYear(yi);
                        setPickYear(false);
                      }}
                      className={`py-2 rounded-xl text-sm ${yi === year ? 'bg-brand-500 text-white' : 'bg-slate-50 text-slate-600'}`}
                    >
                      {yi}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-4 pb-2">
                <div className="grid grid-cols-6 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonth(m)}
                      className={`py-1.5 rounded-lg text-xs ${m === month ? 'bg-brand-500 text-white' : 'bg-slate-50 text-slate-600'}`}
                    >
                      {m}月
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 日历网格 */}
            <div className="px-4 pt-2">
              <div className="grid grid-cols-7 text-center text-[11px] text-slate-300 mb-1">
                {WEEK.map((w) => <span key={w}>{w}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-y-1">
                {cells.map((c, i) => (
                  <div key={i} className="flex justify-center">
                    {c === null ? (
                      <span className="w-9 h-9" />
                    ) : (
                      <button
                        type="button"
                        disabled={isBlocked(c)}
                        onClick={() => setDay(c)}
                        className={`w-9 h-9 rounded-full text-sm ${
                          c === day
                            ? 'bg-brand-500 text-white font-semibold'
                            : isBlocked(c)
                              ? 'text-slate-200'
                              : 'text-slate-700 active:bg-brand-50'
                        }`}
                      >
                        {c}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {mode === 'datetime' && (
              <div className="px-4 pt-3 flex items-center gap-2 text-sm">
                <span className="text-xs text-slate-400">时间</span>
                <select value={time.slice(0, 2)} onChange={(e) => setTime(`${e.target.value}:${time.slice(3, 5)}`)} className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 outline-none">
                  {Array.from({ length: 24 }, (_, h) => pad2(h)).map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-slate-300">:</span>
                <select value={time.slice(3, 5)} onChange={(e) => setTime(`${time.slice(0, 2)}:${e.target.value}`)} className="px-3 py-2 rounded-xl bg-slate-50 text-slate-700 outline-none">
                  {Array.from({ length: 60 }, (_, m) => pad2(m)).map((mi) => <option key={mi} value={mi}>{mi}</option>)}
                </select>
              </div>
            )}

            {/* 快捷与操作 */}
            <div className="px-4 pt-3 flex items-center gap-2">
              {[0, -1, -2, -7].map((off) => (
                <button
                  key={off}
                  type="button"
                  onClick={() => quick(off)}
                  className="px-3 py-1.5 rounded-full bg-slate-50 text-xs text-slate-500"
                >
                  {off === 0 ? '今天' : off === -1 ? '昨天' : off === -2 ? '前天' : '一周前'}
                </button>
              ))}
            </div>

            <div className="p-4 flex gap-3">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm">
                取消
              </button>
              <button type="button" onClick={commit} className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-semibold">
                确定
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
