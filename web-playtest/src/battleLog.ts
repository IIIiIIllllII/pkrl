import {battleName, boostLabel, conditionLabel, effectLabel, statLabel, statusLabel, UI, weatherLabel, type Locale} from './i18n'

/** One public protocol line as a human-readable battle-log entry ('' to omit it). */
export function readableLine(line: string, locale: Locale): string {
  const fields = line.split('|'); const command = fields[1]
  const subject = battleName((fields[2] || '').replace(/^p\da: /, ''), locale)
  const other = battleName((fields[3] || '').replace(/^p\da: /, ''), locale)
  const sideName = (fields[2] || '').startsWith('p1') ? UI[locale].yourSide : UI[locale].opponentSide
  const from = fields.slice(3).find(field => field.startsWith('[from] '))?.slice(7).replace(/^(move|ability|item): /, '')
  const fromText = from ? ` (${battleName(effectLabel(from, locale), locale)})` : ''
  // The pinned format's debug flag makes the shared protocol carry exact HP for
  // both sides; the human sees exact HP only for their own (p1) Pokémon.
  const hpText = locale === 'en' && (fields[2] || '').startsWith('p1') ? fields[3] : conditionLabel(fields[3] || '', locale)
  if (command === 'turn') return locale === 'ko' ? `${fields[2]}턴` : `Turn ${fields[2]}`
  if (command === 'move') return locale === 'ko' ? `${subject}의 ${battleName(fields[3], locale)}!` : `${subject} used ${fields[3]}.`
  if (['switch', 'drag'].includes(command)) return locale === 'ko' ? `${subject}이(가) 배틀에 나왔다. (${battleName(fields[3], locale)})` : `${subject} entered the battle (${fields[3]}).`
  if (command === '-damage') return `${subject}: ${hpText}${fromText}`
  if (command === '-heal') return locale === 'ko' ? `${subject}의 HP가 ${hpText}까지 회복되었다.${fromText}` : `${subject} healed to ${hpText}${fromText}`
  if (command === '-sethp') return `${subject}: ${hpText}${fromText}`
  if (command === '-boost' || command === '-unboost') {
    const amount = Number(fields[4]) || 0
    if (!amount) return locale === 'ko' ? `${subject}의 ${statLabel(fields[3], locale)}은(는) 더 이상 변하지 않는다.` : `${subject}'s ${statLabel(fields[3], locale)} won't go any ${command === '-boost' ? 'higher' : 'lower'}.`
    return `${subject}: ${boostLabel(fields[3], command === '-boost' ? amount : -amount, locale)}${fromText}`
  }
  if (command === '-setboost') return `${subject}: ${boostLabel(fields[3], Number(fields[4]) || 0, locale)}${fromText}`
  if (command === '-clearallboost') return locale === 'ko' ? '모든 능력 변화가 원래대로 돌아왔다.' : 'All stat changes were eliminated.'
  if (command === '-clearboost') return locale === 'ko' ? `${subject}의 능력 변화가 원래대로 돌아왔다.` : `${subject}'s stat changes were removed.`
  if (command === '-clearnegativeboost') return locale === 'ko' ? `${subject}의 떨어진 능력이 원래대로 돌아왔다.${fromText}` : `${subject}'s lowered stats were restored.${fromText}`
  if (command === '-copyboost') return locale === 'ko' ? `${subject}은(는) ${other}의 능력 변화를 복사했다.` : `${subject} copied ${other}'s stat changes.`
  if (command === '-transform') return locale === 'ko' ? `${subject}은(는) ${other}(으)로 변신했다.` : `${subject} transformed into ${other}.`
  if (command === '-weather') {
    if (fields.includes('[upkeep]')) return ''
    if (!fields[2] || fields[2] === 'none') return locale === 'ko' ? '날씨가 원래대로 돌아왔다.' : 'The weather cleared.'
    return `${UI[locale].weather}: ${weatherLabel(fields[2], locale)}${fromText}`
  }
  if (command === '-sidestart') return locale === 'ko' ? `${sideName}: ${effectLabel(fields[3].replace(/^move: /, ''), locale)} 시작` : `${sideName}: ${effectLabel(fields[3].replace(/^move: /, ''), locale)} started.`
  if (command === '-sideend') return locale === 'ko' ? `${sideName}: ${effectLabel(fields[3].replace(/^move: /, ''), locale)} 종료` : `${sideName}: ${effectLabel(fields[3].replace(/^move: /, ''), locale)} ended.`
  if (command === '-start') return locale === 'ko' ? `${subject}: ${effectLabel(fields[3].replace(/^move: /, ''), locale)} 시작` : `${subject}: ${effectLabel(fields[3].replace(/^move: /, ''), locale)} started.`
  if (command === '-end') return locale === 'ko' ? `${subject}: ${effectLabel(fields[3].replace(/^move: /, ''), locale)} 종료` : `${subject}: ${effectLabel(fields[3].replace(/^move: /, ''), locale)} ended.`
  if (command === '-curestatus') return locale === 'ko' ? `${subject}의 ${statusLabel(fields[3], locale)} 상태가 나았다.` : `${subject} was cured of ${fields[3]}.`
  if (command === '-cureteam') return locale === 'ko' ? `${subject}의 팀의 상태이상이 나았다.` : `${subject}'s team was cured of status.`
  if (command === '-status') return locale === 'ko' ? `${subject}은(는) ${statusLabel(fields[3], locale)} 상태가 되었다.` : `${subject} became ${fields[3]}.`
  if (command === 'faint') return locale === 'ko' ? `${subject}은(는) 쓰러졌다.` : `${subject} fainted.`
  if (command === 'win') return locale === 'ko' ? `${subject === 'Human' ? '플레이어' : subject}의 승리!` : `${fields[2]} won.`
  return ''
}
