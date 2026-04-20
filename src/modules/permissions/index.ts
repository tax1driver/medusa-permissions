import { Module } from "@medusajs/framework/utils";
import PermissionsService from "./service";
import PermissionsLoader from "../../loaders/permissions"
export * from "./definitions"

export const PERMISSIONS_MODULE = "permissions";

export const PermissionsModule = Module(PERMISSIONS_MODULE, {
    service: PermissionsService,
    loaders: [PermissionsLoader]
});

export default PermissionsModule;