# V4.36-SIM-IDLE6-NOPULSE

Removes the complete charging pulse and one-minute PackState hold strategy. Keeps continuous measured battery-zero compensation, all ordinary-command priorities and diagnostic-only failure handling. Four Function outputs remain unchanged. TXT/JS/import contain identical tested source.

A fresh prior compensation baseline may migrate, never the84W pulse. Valid standby entry zeros the request once; measurement feedback then resumes. No SmartMode or sleep command added. ModelV16 unchanged.27 offline tests, disabled-compensation historical comparison and enabled Logs28/29 replay pass. A new hardware run is pending.

See [German analysis and primary sources](Analyse_Log_Standby_DE.md) and [installation notes](README_DE.md).
