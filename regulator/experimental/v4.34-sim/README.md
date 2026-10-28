# V4.34-SIM-IDLE4-KICK60: one60W attempt, then continuous battery-zero tracking

[German installation, screenshot analysis and validation](README_DE.md)

During ordinary0/0W demand with fresh battery feedback, actualAC1 and valid PackState2, request60W total for up to60s. A valid PackState transition to charging/standby ends the attempt early. No battery-power-only completion. Preserve the existing supplementary compensation while pausing its feedback during the attempt, then settle8s before resuming tracking. Failed attempts do not repeat within the same idle episode.

On confirmed standby, explicitly request0W once: if the device ignores charging requests in standby, measured0W alone would otherwise leave an old supplementary request unchanged. Then resume real-power feedback. A later standby after timeout is handled too. Any real returning residual is compensated despite a persistent standby label.

All normal positive power demands and existing inhibits retain immediate priority. Invalid-input/error calls remain diagnostic-only; an expired attempt is withdrawn at the next valid call, not by an autonomous hardware timer. Actual delivery can last longer during missing valid calls. Only replace the four-output regulator Function; existing BLE/direction/logger nodes remain.

41 offline tests pass. With just the60W attempt disabled,1195 executed Log28/29 invocations reproduce exactly; four rejected calls remain diagnostic-only. All-feedback-disabled regression matches5324 historical executions and66 rejections. Active kick hardware response pending. The screenshot suggests standby after substantial charging and a20%SOC plateau but cannot establish a fixed trigger, delay or power threshold. ModelV16 unchanged.
