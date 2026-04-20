import { defineLink } from "@medusajs/framework/utils";
import UserModule from "@medusajs/medusa/user";
import { PermissionsModule } from "../modules/permissions";

export default defineLink(
    {
        linkable: PermissionsModule.linkable.rbacRole,
        isList: true
    },
    {
        linkable: UserModule.linkable.user,
        isList: true
    }
);