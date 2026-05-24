import re
from typing import Any


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def parse_telex(telex: str) -> dict[str, Any]:
    """Parse a telex block into structured fields for QR serialization."""
    data: dict[str, Any] = {
        "from": None,
        "from_department": None,
        "to": None,
        "date": None,
        "booking_ref": None,
        "passengers": [],
        "phone_number": None,
        "flights": [],
        "services": [],
        "raw_telex": telex,
    }

    lines = telex.splitlines()

    from_match = re.search(r"^FROM\s+(.+)$", telex, re.MULTILINE)
    if from_match:
        data["from"] = _clean(from_match.group(1))

    to_match = re.search(r"^TO\s+(.+)$", telex, re.MULTILINE)
    if to_match:
        data["to"] = _clean(to_match.group(1))

    booking_match = re.search(r"BOOKING REF\s+([^\n]+)", telex)
    if booking_match:
        data["booking_ref"] = _clean(booking_match.group(1))

    date_match = re.search(r"([A-Za-z]+,\s+\d{1,2},\s+\d{4})", telex)
    if date_match:
        data["date"] = _clean(date_match.group(1))

    for idx, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("FROM ") and idx + 1 < len(lines):
            next_line = lines[idx + 1].strip()
            if next_line and not next_line.startswith("TO"):
                data["from_department"] = _clean(next_line)
                break

    phone_match = re.search(r"Phone number\s*:\s*([\d+ ]+)", telex, re.IGNORECASE)
    if phone_match:
        data["phone_number"] = _clean(phone_match.group(1))

    passenger_pattern = re.compile(r"(MR\.|MRS\.|MS\.)\s*([A-Z'\- ]+)\((\d{2}/\d{2}/\d{4})\)")
    for title, name, birth_date in passenger_pattern.findall(telex.upper()):
        data["passengers"].append(
            {
                "title": title.replace(".", ""),
                "full_name": _clean(name.title()),
                "birth_date": birth_date,
            }
        )

    flight_pattern = re.compile(
        r"NO\s+(\d+)\s+([A-Z]{3})\s+(\d{2}/\d{2}/\d{2})\s+(\d{2}:\d{2})\s*-\s+([A-Z]{3})\s+(\d{2}/\d{2}/\d{2})\s+(\d{2}:\d{2})"
    )
    for number, dep_airport, dep_date, dep_time, arr_airport, arr_date, arr_time in flight_pattern.findall(telex):
        data["flights"].append(
            {
                "number": number,
                "departure_airport": dep_airport,
                "departure_date": dep_date,
                "departure_time": dep_time,
                "arrival_airport": arr_airport,
                "arrival_date": arr_date,
                "arrival_time": arr_time,
            }
        )

    service_names = [
        "Transfer from Aerporto to Steigenber ger Alcazar",
        "Steigenberger Alcazar Resort",
        "Transfer from Steigenberger Alcazar to Aerport",
    ]
    for service_name in service_names:
        if service_name in telex:
            data["services"].append(service_name)

    return data
