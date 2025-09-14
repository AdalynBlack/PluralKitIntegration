import { CspPolicies, ConnectSrc, ImageSrc } from "@main/csp"

CspPolicies["api.pluralkit.me"] = ConnectSrc;
CspPolicies["cdn.pluralkit.me"] = ImageSrc;
