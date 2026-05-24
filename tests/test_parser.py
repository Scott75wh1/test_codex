from parser import parse_telex


TELEX_SAMPLE = """FROM HOTELTURIST SPA - BAOBAB
Backoffice Baobab
TO   LOVE EGYPT TOURS

March, 26, 2026
BOOKING REF 2026/TB/111458
NO  7928   VRN    12/04/26 08:15 - SSH    12/04/26 12:05
NO  7929   SSH    19/04/26 13:10 - VRN    20/04/26 17:40
MR.NEZZO GIORDANO (02/07/1947)
Phone number : 3358203771
MR.SANTER HEDWIG (10/03/1952)
Steigenberger Alcazar Resort
"""


def test_parse_telex_extracts_core_fields():
    parsed = parse_telex(TELEX_SAMPLE)

    assert parsed["from"] == "HOTELTURIST SPA - BAOBAB"
    assert parsed["to"] == "LOVE EGYPT TOURS"
    assert parsed["booking_ref"] == "2026/TB/111458"
    assert parsed["date"] == "March, 26, 2026"
    assert parsed["phone_number"] == "3358203771"


def test_parse_telex_extracts_flights_and_passengers():
    parsed = parse_telex(TELEX_SAMPLE)

    assert len(parsed["passengers"]) == 2
    assert parsed["passengers"][0]["full_name"] == "Nezzo Giordano"
    assert len(parsed["flights"]) == 2
    assert parsed["flights"][0]["number"] == "7928"
