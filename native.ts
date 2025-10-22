import { CspPolicies, ConnectSrc, ImageSrc } from "@main/csp"

CspPolicies["https://api.pluralkit.me"] = ConnectSrc;
CspPolicies["https://*.pluralkit.me"] = ImageSrc;
CspPolicies["https://pluralkit.me"] = ImageSrc;
