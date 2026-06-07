The item builder is currently deactivated but with this work we want to reactive it, in order to understand the data paths availabile read the system and the foundry active effects.

The goal of the creator is that when a user wants to create an item they can add different parts of shadowrun gear to the item and make a unique item from them, the user can setup the active effects not by adding the path but buy clicking together the available paths from the system, we need to use the right active effects modes of foundry v14. When the user has clicked together the active effects those clicks will create the effects with the correct paths. The current ui for creating the active effects is very large, lets make the buttons to select the effects smaller.


also adapt the test of availability:
Basierend auf dem von dir bereitgestellten Regeltext und der `AvailabilityTest`-Klasse lässt sich die Roll-Logik sehr gut mit den offiziellen Shadowrun 5e Regeln (RAW – Rules as Written) abgleichen.

Es gibt in deinem Code eine Logik, die den Regeln am nächsten kommt: **Der `"opposed"` (Vergleichend) Modus**. Allerdings gibt es einige Bereiche, die perfekt umgesetzt sind, und andere, die von den offiziellen Regeln abweichen.

Hier ist die detaillierte Analyse:

### 1. Was die `"opposed"` Logik perfekt abdeckt

* **Die grundlegende Probe (Vergleichende Probe):** Die Regeln verlangen eine Vergleichende Probe auf Verhandlung + Charisma gegen die Verfügbarkeit. Dein Code im `"opposed"`-Modus setzt den Schwellenwert (`threshold.base`) auf 0 und übergibt die Probe an einen `AvailabilityResist`-Test. Das bildet mathematisch genau diese Vergleichende Probe ab: Der Spieler würfelt seinen Pool, der Gegenstand "wehrt" sich mit seiner Verfügbarkeitsstufe.
* **Der Einsatz von Connections:** Der Regeltext besagt, dass Connections *ihre eigene* Verhandlung + Charisma nutzen und zusätzlich Bonuswürfel in Höhe ihrer Einflussstufe (Connection-Wert) erhalten.
* Dein Code setzt dies hervorragend um: Wenn ein Kontakt ausgewählt ist, nutzt das System den verknüpften Akteur des Kontakts für die Attribute/Fertigkeiten.


* Zusätzlich fügt der Code in der `AvailabilityTest`-Klasse (`prepareBaseValues`) korrekt die Connection-Stufe des Kontakts als Bonuswürfel zum Pool hinzu (`pool.addPart(game.i18n.localize("SR5.Connection"), this.contactItem.system.connection)`).



### 2. Was teilweise oder manuell abgedeckt ist

* **Geld für Zusatzwürfel (Bestechung):** Die Regel besagt, dass +25 % des Preises einen zusätzlichen Würfel geben (bis zu +400 % / 12 Würfel).
* In der automatisierten `AvailabilityTest`-Klasse gibt es dafür **keine automatische Berechnung**.
* **Die Lösung:** Spieler oder der Spielleiter (GM) müssen diese Bonuswürfel manuell als Modifikator im Dialogfenster hinzufügen (`modifiers.forEach(mod => pool.addPart(mod.label, mod.value))`).


* **Patzer und Kritische Patzer:** Die Regeln überlassen die Konsequenzen eines (kritischen) Patzers (z.B. Knight Errant, Yakuza) dem Spielleiter. Das System berechnet zwar korrekterweise, ob ein Patzer vorliegt (mehr als die Hälfte der Würfel sind Einsen) und zeigt dies in der UI an, aber die Bestrafung muss narrativ durch den GM erfolgen.



### 3. Was abweicht oder nicht abgedeckt ist (Lücken in der Logik)

* **Lieferzeiten und Nettoerfolge (Die größte Lücke):** Die Regeln besagen klar: *Die angegebene Lieferzeit wird durch die erzielten Nettoerfolge geteilt.* Bei einem Patt (0 Nettoerfolge, aber Probe nicht misslungen) verdoppelt sich die Lieferzeit.
* Dein Code zieht die Nettoerfolge nicht zur Reduzierung der Lieferzeit heran. Der `DeliveryTimeService` im System berechnet die Lieferzeit lediglich basierend auf den Gegenstandskosten und multipliziert diese mit der Anzahl der Würfe (`baseTime.value * rollCount`). Das ist eine Hausregel / Vereinfachung und entspricht nicht RAW.




* **Fehlschlag und erneuter Versuch:** Nach Regeln darf man es bei einem Fehlschlag nach der doppelten Standardlieferzeit noch einmal versuchen.
* Dein Code nutzt stattdessen bei einem Fehlschlag einen Retry-Dialog (`availability-failure-retry-dialog.html`), der dem Spieler einen erneuten Versuch mit einem kumulativen Malus (`failPenalty`) anbietet. Auch dies ist eine mechanische Abweichung (Hausregel) vom Grundregelwerk.





### Fazit und Empfehlung

Die Einstellung **`rule = "opposed"`** deckt das Fundament der Regeln (Poolbildung, Connections und Vergleichende Probe) absolut korrekt ab.

Wenn du das Modul zu 100 % regelkonform machen möchtest, müsstest du die Logik nach dem Wurf (in der `afterTestComplete`-Methode oder im `AppDialogBuilder`) anpassen:

1. Teile die resultierende Basis-Lieferzeit durch die Nettoerfolge (`netHits`).
2. Wenn `netHits === 0` (aber die Probe erfolgreich war), multipliziere die Lieferzeit mit 2.