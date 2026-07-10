import pandas as pd
import json

def propagate_chain_menus():
    print("Loading database...")
    df = pd.read_excel('data/Hungry F&B Database.xlsx', dtype=object)

    # We will use 'Business Name Normalized' to group chains, as it strips out location specific names
    if 'Business Name Normalized' not in df.columns:
        print("Business Name Normalized column missing. Falling back to Stall / Restaurant Name.")
        group_col = 'Stall / Restaurant Name'
    else:
        group_col = 'Business Name Normalized'

    # Filter out empty group names
    valid_groups = df[df[group_col].notna() & (df[group_col] != '')]
    unique_groups = valid_groups[group_col].unique()

    updated_count = 0

    print(f"Checking {len(unique_groups)} unique chains/businesses for missing menus...")

    for group in unique_groups:
        mask = df[group_col] == group
        chain_outlets = df[mask]

        # Check if this chain has any outlet with a populated menu
        has_menu = chain_outlets['Menu'].notna() & (chain_outlets['Menu'] != '')

        if has_menu.any() and not has_menu.all():
            # There is at least one outlet WITH a menu, and at least one WITHOUT

            # Get the first available menu
            valid_menu = chain_outlets.loc[has_menu, 'Menu'].iloc[0]

            # Determine which rows need updating
            missing_mask = mask & (df['Menu'].isna() | (df['Menu'] == ''))

            # Propagate
            df.loc[missing_mask, 'Menu'] = valid_menu

            # Optional: propagate Menu Source and Menu Items as well, if they exist
            if 'Menu Source' in df.columns:
                valid_source = chain_outlets.loc[has_menu, 'Menu Source'].iloc[0] if chain_outlets['Menu Source'].notna().any() else 'Chain Propagation'
                df.loc[missing_mask, 'Menu Source'] = valid_source

            if 'Menu Items' in df.columns:
                valid_items = chain_outlets.loc[has_menu, 'Menu Items'].iloc[0] if chain_outlets['Menu Items'].notna().any() else ''
                df.loc[missing_mask, 'Menu Items'] = valid_items

            updated_count += missing_mask.sum()
            print(f"Propagated menu for chain: {group} ({missing_mask.sum()} outlets updated)")

    print(f"\nTotal missing menus filled via chain propagation: {updated_count}")

    if updated_count > 0:
        print("Saving updated database...")
        df.to_excel('data/Hungry F&B Database.xlsx', index=False)
        print("Saved.")
    else:
        print("No updates needed.")

if __name__ == "__main__":
    propagate_chain_menus()
