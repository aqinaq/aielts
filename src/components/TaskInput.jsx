import { useState } from 'react'
import { ClipboardList, LibraryBig, X } from 'lucide-react'

import { useLanguage } from '../i18n'
import { TASK_BANK } from '../lib/tasks'
import ExamTimer from './ExamTimer'

function TaskPicker({ mode, onPick, onClose }) {
  const { t } = useLanguage()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t('task.pickTitle')}
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {t('task.pickTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('task.close')}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <ul className="space-y-3">
          {TASK_BANK[mode].map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onPick(task)}
                className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    {task.type}
                  </span>
                  <span>
                    {task.minutes} {t('task.minutes')}
                  </span>
                  <span>
                    {task.minWords} {t('task.minWords')}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {task.prompt}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function TaskInput({ mode, value, meta, onChange, onPick }) {
  const { t } = useLanguage()
  const [isPickerOpen, setPickerOpen] = useState(false)

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor="task"
          className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700"
        >
          <ClipboardList className="size-4 text-slate-400" aria-hidden="true" />
          {t('task.label')}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
            {t('task.optional')}
          </span>
        </label>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
        >
          <LibraryBig className="size-3.5" aria-hidden="true" />
          {t('task.pick')}
        </button>
      </div>

      <textarea
        id="task"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        placeholder={t('task.placeholder')}
        className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100"
      />

      {meta ? <ExamTimer minutes={meta.minutes} /> : (
        <p className="text-xs text-slate-400">{t('task.hint')}</p>
      )}

      {isPickerOpen && (
        <TaskPicker
          mode={mode}
          onPick={(task) => {
            onPick(task)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
